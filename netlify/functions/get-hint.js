const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { question, testNumber, questionNumber } = JSON.parse(event.body);
        
        if (!question && (!testNumber || !questionNumber)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Question content or test/question numbers are required' })
            };
        }

        // Get the question content from Airtable if not provided directly
        let questionContent = question;
        if (!questionContent) {
            const Airtable = require('airtable');
            const base = new Airtable({ apiKey: process.env.API_KEY }).base(process.env.BASE_ID);
            
            const records = await base('Questions')
                .select({
                    filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                    fields: ['LatexMarkdown']
                })
                .firstPage();

            if (!records || records.length === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Question not found' })
                };
            }

            questionContent = records[0].get('LatexMarkdown');
        }

        // Generate hint using GPT-4
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful math tutor. When given a math question, provide a hint that guides the student toward the solution without giving away the answer. Use proper LaTeX notation within MathJax delimiters (\\( ... \\) for inline math and \\[ ... \\] for display math) when writing mathematical expressions. Make your hints clear and encouraging."
                },
                {
                    role: "user",
                    content: `Please provide a hint for this math question: ${questionContent}`
                }
            ],
            temperature: 0.7,
            max_tokens: 300
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ hint: response.choices[0].message.content }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };
    } catch (error) {
        console.error('Error generating hint:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate hint' }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };
    }
}; 