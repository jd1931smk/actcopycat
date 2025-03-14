const Airtable = require('airtable');

// Debugging: Log if environment variables are loaded
console.log("Checking environment variables...");
console.log("BASE_ID:", process.env.BASE_ID ? "✅ Loaded" : "❌ MISSING");
console.log("API_KEY:", process.env.API_KEY ? "✅ Loaded" : "❌ MISSING");

// Initialize Airtable with API Key
const base = new Airtable({ apiKey: process.env.API_KEY }).base(process.env.BASE_ID);

exports.handler = async (event) => {
    console.log("Received request with query parameters:", event.queryStringParameters);

    const { action, testNumber, questionNumber, questionId } = event.queryStringParameters || {};

    // Helper function to format response
    const formatResponse = (statusCode, body) => ({
        statusCode,
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });

    try {
        switch (action) {
            case 'getTestNumbers':
                console.log("Fetching Test Numbers...");
                const testNumbers = await base('Questions')
                    .select({ fields: ['Test Number'] })
                    .all()
                    .then(records => {
                        console.log("Raw Records:", records.map(r => r.fields));
                        return [...new Set(records.map(r => r.get('Test Number')).filter(Boolean))];
                    });
                return formatResponse(200, testNumbers);

            case 'getQuestionNumbers':
                if (!testNumber) return formatResponse(400, 'Missing testNumber');
                console.log(`Fetching Question Numbers for Test: ${testNumber}`);
                const questionNumbers = await base('Questions')
                    .select({ filterByFormula: `{Test Number} = '${testNumber}'`, fields: ['Question Number'] })
                    .all()
                    .then(records => records.map(r => r.get('Question Number')).filter(Boolean));
                return formatResponse(200, questionNumbers);

            case 'getQuestionDetails':
                if (!testNumber || !questionNumber) return formatResponse(400, 'Missing testNumber or questionNumber');
                console.log(`Fetching Question Details for Test: ${testNumber}, Question: ${questionNumber}`);
                const question = await base('Questions')
                    .select({
                        filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                        fields: ['Photo', 'Record ID']
                    })
                    .firstPage()
                    .then(records => records[0] ? {
                        id: records[0].get('Record ID'),
                        photo: records[0].get('Photo')
                    } : null);
                if (!question) return formatResponse(404, 'Question not found');
                return formatResponse(200, question);

            case 'getCloneQuestions':
                if (!questionId) return formatResponse(400, 'Missing questionId');
                console.log(`Fetching Clone Questions for Question ID: ${questionId}`);
                const clones = await base('CopyCats')
                    .select({
                        filterByFormula: `FIND('${questionId}', ARRAYJOIN({Original Question}, ','))`,
                        fields: ['Clone Question LM']
                    })
                    .all()
                    .then(records => records.map(r => r.get('Clone Question LM')).filter(Boolean));
                return formatResponse(200, clones);

            default:
                console.log("Invalid action:", action);
                return formatResponse(404, 'Action not found');
        }
    } catch (error) {
        console.error("Airtable API Error:", error);
        return formatResponse(500, { error: error.message });
    }
};
