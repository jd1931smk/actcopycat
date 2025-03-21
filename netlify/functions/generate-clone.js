const Airtable = require('airtable');
const OpenAI = require('openai');

// Initialize Airtable
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.BASE_ID);

// Initialize OpenAI with proper error handling
let openai;
try {
    openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY,
        maxRetries: 3,
        timeout: 30000
    });
} catch (error) {
    console.error('Failed to initialize OpenAI:', error);
}

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

        // Check if OpenAI is properly initialized
        if (!openai) {
            throw new Error('OpenAI client not properly initialized');
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
                console.log('Found LaTeX content:', questionLatex ? 'Yes' : 'No');
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
        
        // Log the content we're sending to GPT
        console.log('Question content being sent to GPT:', {
            hasLatex: !!questionLatex,
            hasPhoto: !!photo,
            testNumber,
            questionNumber
        });

        // Clean up the LaTeX content if it exists
        if (questionLatex) {
            // Remove any HTML tags that might interfere with GPT's understanding
            questionLatex = questionLatex.replace(/<[^>]*>/g, '');
            // Fix any double escaped LaTeX delimiters
            questionLatex = questionLatex.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)');
            questionLatex = questionLatex.replace(/\\\\\[/g, '\\[').replace(/\\\\\]/g, '\\]');
            // Ensure proper spacing around delimiters
            questionLatex = questionLatex.replace(/([^\s])\\\(/g, '$1 \\(').replace(/\\\)([^\s])/g, '\\) $1');
            questionLatex = questionLatex.replace(/([^\s])\\\[/g, '$1 \\[').replace(/\\\]([^\s])/g, '\\] $1');
        }

        // Construct the prompt for GPT-4
        let prompt = `Please analyze and create a clone of this ACT Math question:

${questionLatex || 'Image-based question'}

${photo ? '[This question includes an image showing a geometric figure with the following properties: parallel lines, angles, and measurements. The question asks about finding a specific angle measure.]' : ''}

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

For this geometry question, create a similar problem about finding angle measures in intersecting lines, but use different angle values and a slightly different setup. Make sure to include clear angle measures in the question.

Structure your response exactly as follows:

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
                    content: "You are a helpful AI that creates high-quality clone questions for ACT Math practice. You must structure your response exactly as requested with the Analysis, New Question, Answer, and Explanation sections."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        console.log('Received response from GPT-4');
        const response = completion.choices[0].message.content;
        console.log('Response content length:', response.length);

        // Parse the response with more flexible regex
        const analysisMatch = response.match(/\*\*Analysis:\*\*([\s\S]*?)(?=\*\*New Question:\*\*)/);
        const questionMatch = response.match(/\*\*New Question:\*\*([\s\S]*?)(?=\*\*Answer:\*\*)/);
        const answerMatch = response.match(/\*\*Answer:\*\*([\s\S]*?)(?=\*\*Explanation:\*\*)/);
        const explanationMatch = response.match(/\*\*Explanation:\*\*([\s\S]*?)$/);

        if (!questionMatch || !answerMatch || !explanationMatch) {
            console.error('Failed to parse GPT response. Response structure:', {
                hasAnalysis: !!analysisMatch,
                hasQuestion: !!questionMatch,
                hasAnswer: !!answerMatch,
                hasExplanation: !!explanationMatch,
                response
            });
            throw new Error('Failed to parse GPT response - missing required sections');
        }

        // Clean up the extracted content
        const cleanAnswer = answerMatch[1].trim().match(/([A-E])/)?.[1];
        if (!cleanAnswer) {
            throw new Error('Invalid answer format - must be a single letter A-E');
        }

        const cleanQuestion = questionMatch[1].trim()
            .replace(/^\s*\n+/g, '') // Remove leading newlines
            .replace(/\n+\s*$/g, ''); // Remove trailing newlines

        console.log('Saving clone to Airtable');
        // Save to Airtable
        const record = await base('tblpE46FDmB0LmeTU').create({
            'Original Question': `${testNumber} - ${questionNumber}`,
            'Corrected Clone Question LM': cleanQuestion,
            'Answer': cleanAnswer,
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
                question: cleanQuestion,
                answer: cleanAnswer,
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
                details: 'Failed to generate or save clone question',
                stack: error.stack
            })
        };
    }
}; 