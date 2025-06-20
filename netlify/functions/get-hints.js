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
        
        console.log('=== BACKEND HINT DEBUG START ===');
        console.log('Received testNumber:', testNumber);
        console.log('Received questionNumber:', questionNumber);
        console.log('Received question content:', question);
        console.log('Question content length:', question ? question.length : 'undefined');
        console.log('First 300 chars of question:', question ? question.substring(0, 300) : 'undefined');
        
        if (!testNumber || !questionNumber || !question) {
            console.log('Missing required parameters!');
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

        console.log('Full prompt being sent to GPT-4:');
        console.log(prompt);
        console.log('=== BACKEND HINT DEBUG END ===');

        // Get hints from each model independently
        const hints = await Promise.allSettled([
            // deepseek.generateHint(prompt).catch(error => {
            //     console.error('DeepSeek API Error:', error);
            //     return 'Unable to generate hint at this time.';
            // }),
            openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 250
            }).then(response => response.choices[0].message.content)
            .catch(error => {
                console.error('OpenAI API Error:', error);
                return 'Unable to generate hint at this time.';
            }),
            // anthropic.generateHint(prompt).catch(error => {
            //     console.error('Anthropic API Error:', error);
            //     return 'Unable to generate hint at this time.';
            // })
        ]);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                deepseek: 'Temporarily disabled',
                gpt4: hints[0].value || 'Unable to generate hint at this time.',
                claude: 'Temporarily disabled'
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