const Airtable = require('airtable');
const OpenAI = require('openai');

// Initialize Airtable
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.BASE_ID);

// Log environment variables status at startup
console.log('Environment variables check:', {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Present' : '❌ Missing',
    AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY ? '✅ Present' : '❌ Missing',
    BASE_ID: process.env.BASE_ID ? '✅ Present' : '❌ Missing'
});

// Initialize OpenAI
const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 2,
    timeout: 8000  // Reduced timeout to ensure we don't hit Netlify's limit
});

exports.handler = async function(event, context) {
    console.log('Function invoked:', event.httpMethod, event.path);

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { testNumber, questionNumber, latex, photo, checkOnly, recordId } = JSON.parse(event.body);
        
        // If checkOnly is true, just check the status of an existing record
        if (checkOnly && recordId) {
            try {
                const record = await base('tblpE46FDmB0LmeTU').find(recordId);
                const status = record.get('Status');
                
                if (status === 'complete') {
                    return {
                        statusCode: 200,
                        body: JSON.stringify({
                            status: 'complete',
                            question: record.get('Corrected Clone Question LM'),
                            answer: record.get('Answer'),
                            explanation: record.get('Explanation')
                        })
                    };
                } else {
                    return {
                        statusCode: 202,
                        body: JSON.stringify({
                            status: 'pending',
                            recordId
                        })
                    };
                }
            } catch (error) {
                console.error('Error checking record:', error);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: 'Failed to check record status' })
                };
            }
        }

        // Create a new record for tracking
        const record = await base('tblpE46FDmB0LmeTU').create({
            'Original Question': `${testNumber} - ${questionNumber}`,
            'Status': 'pending',
            'Model': 'GPT-4o'
        });

        // Start the generation process in the background
        generateClone(record.id, testNumber, questionNumber, latex, photo).catch(console.error);

        // Return immediately with the record ID
        return {
            statusCode: 202,
            body: JSON.stringify({
                status: 'pending',
                recordId: record.id,
                message: 'Clone generation started'
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function generateClone(recordId, testNumber, questionNumber, latex, photo) {
    try {
        // Clean up the LaTeX content if it exists
        if (latex) {
            latex = latex.replace(/<[^>]*>/g, '')
                .replace(/\\\\\(/g, '\\(')
                .replace(/\\\\\)/g, '\\)')
                .replace(/\\\\\[/g, '\\[')
                .replace(/\\\\\]/g, '\\]')
                .replace(/([^\s])\\\(/g, '$1 \\(')
                .replace(/\\\)([^\s])/g, '\\) $1');
        }

        const prompt = `Please analyze and create a clone of this ACT Math question:

${latex || 'Image-based question'}

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

        const response = completion.choices[0].message.content;

        // Extract the sections
        const questionMatch = response.match(/New Question:\s*([\s\S]*?)(?=\n\s*Answer:)/);
        const answerMatch = response.match(/Answer:\s*([A-E])/);
        const explanationMatch = response.match(/Explanation:\s*([\s\S]*?)$/);

        if (!questionMatch || !answerMatch || !explanationMatch) {
            throw new Error('Failed to parse GPT response');
        }

        // Update the record with the generated content
        await base('tblpE46FDmB0LmeTU').update(recordId, {
            'Corrected Clone Question LM': questionMatch[1].trim(),
            'Answer': answerMatch[1].trim(),
            'Explanation': explanationMatch[1].trim(),
            'Status': 'complete'
        });

    } catch (error) {
        // Update the record with the error
        await base('tblpE46FDmB0LmeTU').update(recordId, {
            'Status': 'error',
            'Error': error.message
        });
    }
} 