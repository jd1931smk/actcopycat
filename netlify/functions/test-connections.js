const Airtable = require('airtable');
const OpenAI = require('openai');

exports.handler = async function(event, context) {
    console.log('Test function invoked');
    
    const results = {
        environment: {},
        airtable: null,
        openai: null
    };

    // Check environment variables
    const vars = ['AIRTABLE_API_KEY', 'OPENAI_API_KEY', 'BASE_ID'];
    vars.forEach(key => {
        results.environment[key] = {
            exists: !!process.env[key],
            length: process.env[key] ? process.env[key].length : 0
        };
    });

    // Test Airtable
    try {
        console.log('Testing Airtable...');
        const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.BASE_ID);
        const records = await base('tblpE46FDmB0LmeTU').select({ maxRecords: 1 }).firstPage();
        results.airtable = {
            success: true,
            recordCount: records.length
        };
    } catch (error) {
        results.airtable = {
            success: false,
            error: error.message
        };
    }

    // Test OpenAI
    try {
        console.log('Testing OpenAI...');
        const openai = new OpenAI({ 
            apiKey: process.env.OPENAI_API_KEY,
            maxRetries: 2,
            timeout: 8000
        });
        const models = await openai.models.list();
        results.openai = {
            success: true,
            modelCount: models.data.length
        };
    } catch (error) {
        results.openai = {
            success: false,
            error: error.message
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify(results, null, 2)
    };
}; 