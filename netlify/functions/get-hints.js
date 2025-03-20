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

        // Debug log for environment and API keys
        console.log('Environment:', {
            NODE_ENV: process.env.NODE_ENV,
            NETLIFY: process.env.NETLIFY,
            CONTEXT: process.env.CONTEXT
        });
        
        console.log('API Keys present:', {
            openai: !!process.env.OPENAI_API_KEY,
            deepseek: !!process.env.DEEPSEEK_API_KEY,
            anthropic: !!process.env.ANTHROPIC_API_KEY
        });

        // Initialize API clients with better error handling
        let deepseek = null;
        let openai = null;
        let anthropic = null;

        try {
            deepseek = new DeepSeekAPI(process.env.DEEPSEEK_API_KEY);
        } catch (error) {
            console.error('Failed to initialize DeepSeek client:', error);
        }

        try {
            if (process.env.OPENAI_API_KEY) {
                openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            }
        } catch (error) {
            console.error('Failed to initialize OpenAI client:', error);
        }

        try {
            if (process.env.ANTHROPIC_API_KEY) {
                anthropic = new AnthropicAPI(process.env.ANTHROPIC_API_KEY);
            }
        } catch (error) {
            console.error('Failed to initialize Anthropic client:', error);
        }

        // Prepare the prompt for all models
        const prompt = `For this ACT Math question (Test ${testNumber}, Question ${questionNumber}):

${question}

Please provide a helpful hint that guides the student toward the solution without giving away the answer directly. The hint should:
1. Point out key information or concepts needed
2. Suggest a problem-solving approach
3. Help identify what mathematical principles to apply
4. NOT reveal the actual answer or solution steps`;

        // Get hints from each model independently with detailed error logging
        let deepseekHint = 'Unable to generate hint at this time.';
        let gpt4Hint = 'Unable to generate hint at this time.';
        let claudeHint = 'Unable to generate hint at this time.';

        if (deepseek) {
            try {
                console.log('Attempting to get DeepSeek hint...');
                deepseekHint = await deepseek.generateHint(prompt);
                console.log('Successfully got DeepSeek hint');
            } catch (error) {
                console.error('DeepSeek API Error:', {
                    message: error.message,
                    response: error.response?.data,
                    stack: error.stack
                });
            }
        } else {
            console.log('DeepSeek client not initialized');
        }

        if (openai) {
            try {
                console.log('Attempting to get GPT-4 hint...');
                const gpt4Response = await openai.chat.completions.create({
                    model: 'gpt-4-turbo-preview',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 250
                });
                gpt4Hint = gpt4Response.choices[0].message.content;
                console.log('Successfully got GPT-4 hint');
            } catch (error) {
                console.error('OpenAI API Error:', {
                    message: error.message,
                    response: error.response?.data,
                    stack: error.stack
                });
            }
        } else {
            console.log('OpenAI client not initialized');
        }

        if (anthropic) {
            try {
                console.log('Attempting to get Claude hint...');
                claudeHint = await anthropic.generateHint(prompt);
                console.log('Successfully got Claude hint');
            } catch (error) {
                console.error('Anthropic API Error:', {
                    message: error.message,
                    response: error.response?.data,
                    stack: error.stack
                });
            }
        } else {
            console.log('Anthropic client not initialized');
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
        console.error('Function Error:', {
            message: error.message,
            stack: error.stack
        });
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}; 