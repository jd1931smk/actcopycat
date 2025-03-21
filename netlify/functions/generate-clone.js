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
            try {
                const records = await base('Questions')
                    .select({
                        filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = '${questionNumber}')`,
                        fields: ['LatexMarkdown']
                    })
                    .firstPage();

                if (records && records.length > 0) {
                    questionLatex = records[0].get('LatexMarkdown');
                    console.log('Found LaTeX content:', questionLatex ? 'Yes' : 'No');
                }
            } catch (error) {
                console.error('Error fetching from Questions table:', error);
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
            photoUrl: photo?.url,
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

${photo ? `[This question includes an image showing mathematical content. The image shows: ${photo.description}. Please create a similar question that could be represented with a similar diagram.]` : ''}

Please perform the following tasks:

1. Analyze the question and identify the key mathematical concepts being tested.
2. Create a new question that:
   - Tests the same concepts
   - Has a similar difficulty level
   - Uses different numbers and context
   - Follows the exact same format (including answer choices A-E)
   - If the original uses a diagram, create a question that would work with a similar diagram
3. Provide a simple explanation of how to solve the question.

Format your response exactly like this:

Analysis:
[Your analysis here]

New Question:
[Your question here with answer choices A-E]

Answer:
[Correct answer letter]

Explanation:
[Simple explanation here]`;

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
            max_tokens: 1000
        });

        console.log('Received response from GPT-4');
        const response = completion.choices[0].message.content;
        console.log('Response content length:', response.length);

        // Extract the sections using regex
        const analysisMatch = response.match(/Analysis:\s*([\s\S]*?)(?=\n\s*New Question:)/);
        const questionMatch = response.match(/New Question:\s*([\s\S]*?)(?=\n\s*Answer:)/);
        const answerMatch = response.match(/Answer:\s*([A-E])/);
        const explanationMatch = response.match(/Explanation:\s*([\s\S]*?)$/);

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

        // Clean up the question text
        const cleanQuestion = questionMatch[1].trim();
        const cleanAnswer = answerMatch[1].trim();

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