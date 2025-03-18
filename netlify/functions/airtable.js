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
                        return [...new Set(records.map(r => r.get('Test Number')).filter(Boolean))]
                            .sort((a, b) => a.localeCompare(b));
                    });
                return formatResponse(200, testNumbers);

            case 'getQuestionNumbers':
                if (!testNumber) return formatResponse(400, 'Missing testNumber');
                console.log(`Fetching Question Numbers for Test: ${testNumber}`);
                
                const questionNumbers = await base('Questions')
                    .select({ filterByFormula: `({Test Number} = '${testNumber}')`, fields: ['Question Number'] })
                    .all()
                    .then(records => 
                        records
                            .map(r => r.get('Question Number'))
                            .filter(Boolean)
                            .map(num => Number(num)) // Convert to numbers for sorting
                            .sort((a, b) => a - b)   // Sort numerically
                    );

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
                if (!testNumber || !questionNumber) {
                    console.error("❌ Missing testNumber or questionNumber in request:", event.queryStringParameters);
                    return formatResponse(400, { error: "Missing testNumber or questionNumber" });
                }

                console.log(`✅ Fetching Record ID for Test: ${testNumber}, Question: ${questionNumber}`);
                
                // Step 1: Retrieve the Record ID from the Questions table
                const questionRecord = await base('Questions')
                    .select({
                        filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                        fields: ['Record ID']
                    })
                    .firstPage()
                    .then(records => records[0] ? records[0].get('Record ID') : null);

                if (!questionRecord) {
                    console.log("No matching record found in Questions table.");
                    return formatResponse(404, 'Question not found');
                }

                console.log(`Found Record ID: ${questionRecord}`);

                // Step 2: Fetch Clone Questions from the CopyCats table using the Record ID
                console.log(`🔍 Searching for clones with Record ID: ${questionRecord}`);
                console.log(`🔍 Querying CopyCats for Linked Record ID: ${questionRecord}`);

                const clones = await base('CopyCats')
                    .select({
                        filterByFormula: `{Original Question} = '${testNumber} - ${questionNumber}'`,
                        fields: ['Clone Question LM']
                    })
                    .all()
                    .then(records => {
                        console.log(`📌 Found ${records.length} clone questions`);
                        console.log("Clone Question Records:", records.map(r => r.fields));
                        return records.map(r => r.get('Clone Question LM')).filter(Boolean);
                    });

                console.log(`✅ Clone Questions Retrieved:`, clones);
                console.log("Raw clone records:", clones);

                // Trigger MathJax to re-render after inserting the content
                if (typeof window !== "undefined" && window.MathJax) {
                    window.MathJax.typesetPromise();
                }

                return formatResponse(200, clones.map(q => `$$${q}$$`));

            default:
                console.log("Invalid action:", action);
                return formatResponse(404, 'Action not found');
        }
    } catch (error) {
        console.error("Airtable API Error:", error);
        return formatResponse(500, { error: error.message });
    }
};
