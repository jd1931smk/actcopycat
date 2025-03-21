const Airtable = require('airtable');
const OpenAI = require('openai');

const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }

    try {
        console.log('Received request to generate clone');
        const { testNumber, questionNumber, latex, photo } = JSON.parse(event.body);
        
        if (!testNumber || !questionNumber) {
            console.error('Missing required parameters');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Test number and question number are required' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // If latex wasn't provided, try to get it from the Questions table
        let questionLatex = latex;
        if (!questionLatex) {
            console.log('Latex not provided, fetching from Questions table');
            const records = await base('Questions')
                .select({
                    filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                    fields: ['LatexMarkdown']
                })
                .firstPage();

            if (records && records.length > 0) {
                questionLatex = records[0].get('LatexMarkdown');
            }
        }

        if (!questionLatex && !photo) {
            console.error('No latex or photo available for question');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Question content not available' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }
        
        // Construct the prompt for GPT-4o
        let prompt = `Please analyze and create a clone of this ACT Math question:

${questionLatex || 'Image-based question'}

${photo ? '[This question includes an image]' : ''}

Please perform the following tasks:

1) Analyze the question as if you are a 17-year-old student. Think about why a student might choose each of the wrong answers.

2) Create a similar question with different values and/or context. The new question must follow these strict formatting rules:
   - Use proper LaTeX syntax within MathJax delimiters
   - Use \\\\( ... \\\\) for inline math expressions (ensure proper spacing around delimiters)
   - Use \\\\[ ... \\\\] for standalone/display math equations (on their own line)
   - Do NOT begin with a number (e.g., "9." or "1.")
   - Do NOT begin with introductory text (e.g., "Here is a new question" or "Consider the following")
   - Start directly with the question content (e.g., "What is the value of \\\\(x\\\\)...")
   - Include the multiple choice answers as part of the question text, formatted as:
     (A) \\\\(answer\\\\)
     (B) \\\\(answer\\\\)
     (C) \\\\(answer\\\\)
     (D) \\\\(answer\\\\)
     (E) \\\\(answer\\\\)
   - Ensure all mathematical expressions are properly formatted with correct LaTeX commands
   - Remove any unnecessary line breaks or spaces
   - Use proper spacing around math delimiters (e.g., "If \\\\( x = 5 \\\\), then..." not "If\\\\(x=5\\\\),then...")

3) Provide an explanation of how to solve the new question, written as if you are a 17-year-old average math student explaining it to a peer. Use simple language and avoid advanced mathematical terms. Follow the same formatting rules for any math expressions in the explanation.

Structure your response as follows:

**Analysis:**

[Your analysis here]

**New Question:**

[Complete question including the multiple choice answers, all with proper MathJax formatting]

**Answer:**

[Just the letter of the correct answer (A, B, C, D, or E) with no quotes or additional text]

**Explanation:**

[Your explanation here with proper MathJax formatting]`;

        console.log('Calling GPT-4 to generate clone');
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful AI that creates high-quality clone questions for ACT Math practice."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        const response = completion.choices[0].message.content;
        console.log('Received response from GPT-4');

        // Parse the response
        const analysisMatch = response.match(/\*\*Analysis:\*\*\n\n([\s\S]*?)(?=\n\n\*\*New Question:\*\*)/);
        const questionMatch = response.match(/\*\*New Question:\*\*\n\n([\s\S]*?)(?=\n\n\*\*Answer:\*\*)/);
        const answerMatch = response.match(/\*\*Answer:\*\*\n\n([A-E])/);
        const explanationMatch = response.match(/\*\*Explanation:\*\*\n\n([\s\S]*?)$/);

        if (!questionMatch || !answerMatch || !explanationMatch) {
            console.error('Failed to parse GPT response:', response);
            throw new Error('Failed to parse GPT response');
        }

        console.log('Saving clone to Airtable');
        // Save to Airtable
        const record = await base('tblpE46FDmB0LmeTU').create({
            'Original Question': `${testNumber} - ${questionNumber}`,
            'Corrected Clone Question LM': questionMatch[1].trim(),
            'Answer': answerMatch[1],
            'Model': 'GPT-4o',
            'Explanation': explanationMatch[1].trim()
        });

        console.log('Clone saved successfully');
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: questionMatch[1].trim(),
                answer: answerMatch[1],
                explanation: explanationMatch[1].trim(),
                recordId: record.id
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                error: error.message,
                details: 'Failed to generate or save clone question'
            })
        };
    }
}; 