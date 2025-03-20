// Load environment variables from .env file if present
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

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
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const anthropic = new AnthropicAPI(process.env.ANTHROPIC_API_KEY);

        // Prepare the prompt for all models
        const prompt = `For this ACT Math question (Test ${testNumber}, Question ${questionNumber}):

${question}

Please provide a helpful hint that guides the student toward the solution without giving away the answer directly. The hint should:
1. Point out key information or concepts needed
2. Suggest a problem-solving approach
3. Help identify what mathematical principles to apply
4. NOT reveal the actual answer or solution steps`;

        // Get hints from each model independently
        let deepseekHint = 'Unable to generate hint at this time.';
        let gpt4Hint = 'Unable to generate hint at this time.';
        let claudeHint = 'Unable to generate hint at this time.';

        try {
            deepseekHint = await deepseek.generateHint(prompt);
        } catch (error) {
            console.error('DeepSeek API Error:', error);
        }

        try {
            const gpt4Response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 250
            });
            gpt4Hint = gpt4Response.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API Error:', error);
        }

        try {
            claudeHint = await anthropic.generateHint(prompt);
        } catch (error) {
            console.error('Anthropic API Error:', error);
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                deepseek: deepseekHint,
                gpt4: gpt4Hint,
                claude: claudeHint
            })
        };
    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}; 