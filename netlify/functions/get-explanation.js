const OpenAI = require('openai');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { testNumber, questionNumber, question } = JSON.parse(event.body);
        
        if (!testNumber || !questionNumber || !question) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required parameters' })
            };
        }

        // Initialize OpenAI client
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Prepare the prompt for the explanation
        const prompt = `For this ACT Math question (Test ${testNumber}, Question ${questionNumber}):

${question}

Please provide a detailed explanation of how to solve this problem. The explanation should:
1. Break down the key information given in the question
2. Explain the mathematical concepts and principles involved
3. Walk through the solution step by step
4. Explain why each step is necessary
5. Conclude with the final answer and verify it makes sense

Format your response using LaTeX math notation where appropriate, using \( \) for inline math and \[ \] for display math.`;

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 1000
            });

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ explanation: response.choices[0].message.content })
            };
        } catch (error) {
            console.error('OpenAI API Error:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to generate explanation' })
            };
        }
    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}; 