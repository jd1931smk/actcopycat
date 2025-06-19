const Airtable = require('airtable');
const OpenAI = require('openai');

// Validate environment variables
function validateEnvironment() {
    console.log('Validating environment variables...');
    
    const requiredVars = {
        'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
        'AIRTABLE_API_KEY': process.env.AIRTABLE_API_KEY,
        'BASE_ID': process.env.BASE_ID
    };

    // Log the presence/absence of each variable (without revealing values)
    Object.entries(requiredVars).forEach(([key, value]) => {
        console.log(`${key}: ${value ? '✓ Present' : '✗ Missing'}`);
        if (value) {
            console.log(`${key} length: ${value.length}`);
        }
    });

    const missingVars = Object.entries(requiredVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    console.log('Environment variables validated successfully');
}

// Initialize services with proper error handling
async function initializeServices() {
    console.log('Starting service initialization...');
    
    try {
        validateEnvironment();
        
        console.log('Initializing Airtable...');
        const base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY,
            endpointUrl: 'https://api.airtable.com'
        }).base(process.env.BASE_ID);

        // Test Airtable connection
        console.log('Testing Airtable connection...');
        await base('tblpE46FDmB0LmeTU').select({ maxRecords: 1 }).firstPage();
        console.log('Airtable connection successful');

        console.log('Initializing OpenAI...');
        const openai = new OpenAI({ 
            apiKey: process.env.OPENAI_API_KEY,
            maxRetries: 2,
            timeout: 8000
        });

        // Test OpenAI connection
        console.log('Testing OpenAI connection...');
        await openai.models.list();
        console.log('OpenAI connection successful');

        console.log('All services initialized successfully');
        return { base, openai };
    } catch (error) {
        console.error('Service initialization failed:', {
            error: error.message,
            stack: error.stack,
            name: error.name
        });
        throw error;
    }
}

exports.handler = async function(event, context) {
    // 🚨 AI CLONE GENERATION FUNCTION ACCESS 🚨
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    const userAgent = event.headers['user-agent'] || 'unknown';
    
    console.log('🚨🤖 AI CLONE GENERATION FUNCTION ACCESSED 🤖🚨');
    console.log('⚠️  This is private AI code and your activity is being monitored ⚠️');
    console.log('IP:', clientIP);
    console.log('User Agent:', userAgent);
    console.log('Method:', event.httpMethod);
    console.log('🔒 AI FUNCTION ACCESS LOGGED 🔒');

    console.log('Function invoked:', {
        method: event.httpMethod,
        path: event.path
    });

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405,
            headers: {
                'X-Security-Warning': 'This is private code and your activity is being monitored',
                'X-Function': 'generate-clone',
                'X-Access-Logged': 'true',
                'X-IP-Tracked': clientIP
            },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    let services;
    try {
        services = await initializeServices();
    } catch (error) {
        console.error('Failed to initialize services:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Service initialization failed',
                details: error.message
            })
        };
    }

    try {
        const { testNumber, questionNumber, latex, photo, checkOnly, recordId } = JSON.parse(event.body);
        
        // If checkOnly is true, just check the status of an existing record
        if (checkOnly && recordId) {
            try {
                console.log('Checking record status:', recordId);
                const record = await services.base('tblpE46FDmB0LmeTU').find(recordId);
                const status = record.get('Status');
                console.log('Record status:', status);
                
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
                } else if (status === 'error') {
                    return {
                        statusCode: 500,
                        body: JSON.stringify({
                            status: 'error',
                            error: record.get('Error') || 'Unknown error occurred'
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
                    body: JSON.stringify({ 
                        error: 'Failed to check record status',
                        details: error.message
                    })
                };
            }
        }

        // Create a new record for tracking
        console.log('Creating new record for:', testNumber, questionNumber);
        const record = await services.base('tblpE46FDmB0LmeTU').create({
            'Original Question': `${testNumber} - ${questionNumber}`,
            'Status': 'pending',
            'Model': 'GPT-4o'
        });
        console.log('Created record:', record.id);

        // Start the generation process
        console.log('Starting clone generation...');
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

        console.log('Sending request to OpenAI...');
        const completion = await services.openai.chat.completions.create({
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

        console.log('Received response from OpenAI');
        const response = completion.choices[0].message.content;

        // Extract the sections
        const questionMatch = response.match(/New Question:\s*([\s\S]*?)(?=\n\s*Answer:)/);
        const answerMatch = response.match(/Answer:\s*([A-E])/);
        const explanationMatch = response.match(/Explanation:\s*([\s\S]*?)$/);

        if (!questionMatch || !answerMatch || !explanationMatch) {
            throw new Error('Failed to parse GPT response - missing required sections');
        }

        // Update the record with the generated content
        await services.base('tblpE46FDmB0LmeTU').update(record.id, {
            'Corrected Clone Question LM': questionMatch[1].trim(),
            'Answer': answerMatch[1].trim(),
            'Explanation': explanationMatch[1].trim(),
            'Status': 'complete'
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'complete',
                recordId: record.id,
                question: questionMatch[1].trim(),
                answer: answerMatch[1].trim(),
                explanation: explanationMatch[1].trim()
            })
        };

    } catch (error) {
        console.error('Error in handler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message,
                stack: error.stack
            })
        };
    }
}; 