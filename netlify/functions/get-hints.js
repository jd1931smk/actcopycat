require('dotenv').config();
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

        // Debug log for API keys (will be visible in Netlify function logs)
        console.log('API Keys present:', {
            openai: !!process.env.OPENAI_API_KEY,
            deepseek: !!process.env.DEEPSEEK_API_KEY,
            anthropic: !!process.env.ANTHROPIC_API_KEY
        });

        // Check for required API keys
        if (!process.env.OPENAI_API_KEY || !process.env.DEEPSEEK_API_KEY || !process.env.ANTHROPIC_API_KEY) {
            console.error('Missing API keys:', {
                openai: !process.env.OPENAI_API_KEY,
                deepseek: !process.env.DEEPSEEK_API_KEY,
                anthropic: !process.env.ANTHROPIC_API_KEY
            });
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    error: 'Server configuration error - Missing API keys',
                    details: {
                        openai: !process.env.OPENAI_API_KEY ? 'missing' : 'present',
                        deepseek: !process.env.DEEPSEEK_API_KEY ? 'missing' : 'present',
                        anthropic: !process.env.ANTHROPIC_API_KEY ? 'missing' : 'present'
                    }
                })
            };
        }

        // Initialize API clients
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const deepseek = new DeepSeekAPI(process.env.DEEPSEEK_API_KEY);
        const anthropic = new AnthropicAPI(process.env.ANTHROPIC_API_KEY);

        // Prepare the prompt for all models
        const prompt = `For this ACT Math question (Test ${testNumber}, Question ${questionNumber}):

${question}

Please provide a helpful hint that guides the student toward the solution without giving away the answer directly. The hint should:
1. Point out key information or concepts needed
2. Suggest a problem-solving approach
3. Help identify what mathematical principles to apply
4. NOT reveal the actual answer or solution steps`;

        // Get hints from all three models in parallel
        const [deepseekHint, gpt4Hint, claudeHint] = await Promise.all([
            // DeepSeek hint
            deepseek.generateHint(prompt).catch(error => {
                console.error('DeepSeek API Error:', error.response?.data || error.message);
                return 'Unable to generate hint at this time.';
            }),
            
            // GPT-4 hint
            openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 250
            }).then(response => response.choices[0].message.content)
            .catch(error => {
                console.error('OpenAI API Error:', error.response?.data || error.message);
                return 'Unable to generate hint at this time.';
            }),
            
            // Claude 3.5 hint
            anthropic.generateHint(prompt).catch(error => {
                console.error('Anthropic API Error:', error.response?.data || error.message);
                return 'Unable to generate hint at this time.';
            })
        ]);

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