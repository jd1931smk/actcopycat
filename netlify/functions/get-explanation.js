const OpenAI = require('openai');
const { DeepSeekAPI } = require('./deepseek-api');
const { AnthropicAPI } = require('./anthropic-api');

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

        // Initialize API clients
        const deepseek = new DeepSeekAPI(process.env.DEEPSEEK_API_KEY);

        // Prepare the prompt for the explanation
        const prompt = `For this ACT Math question (Test ${testNumber}, Question ${questionNumber}):

${question}

Please provide a detailed explanation of how to solve this problem. The explanation should:
1. Break down the key information given in the question
2. Explain the mathematical concepts and principles involved
3. Walk through the solution step by step
4. Explain why each step is necessary
5. Conclude with the final answer and verify it makes sense`;

        try {
            const explanation = await deepseek.generateHint(prompt);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ explanation })
            };
        } catch (error) {
            console.error('DeepSeek API Error:', error);
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