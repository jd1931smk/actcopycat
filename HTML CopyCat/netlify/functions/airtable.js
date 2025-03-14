const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.API_KEY }).base(process.env.BASE_ID);

exports.handler = async (event) => {
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
                const testNumbers = await base('Questions')
                    .select({ fields: ['Test Number'] })
                    .all()
                    .then(records => [...new Set(records.map(r => r.get('Test Number')).filter(Boolean))]);
                return formatResponse(200, testNumbers);

            case 'getQuestionNumbers':
                if (!testNumber) return formatResponse(400, 'Missing testNumber');
                const questionNumbers = await base('Questions')
                    .select({ filterByFormula: `{Test Number} = '${testNumber}'`, fields: ['Question Number'] })
                    .all()
                    .then(records => records.map(r => r.get('Question Number')).filter(Boolean));
                return formatResponse(200, questionNumbers);

            case 'getQuestionDetails':
                if (!testNumber || !questionNumber) return formatResponse(400, 'Missing testNumber or questionNumber');
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
                const clones = await base('CopyCats')
                    .select({
                        filterByFormula: `FIND('${questionId}', ARRAYJOIN({Original Question}, ','))`,
                        fields: ['Clone Question LM']
                    })
                    .all()
                    .then(records => records.map(r => r.get('Clone Question LM')).filter(Boolean));
                return formatResponse(200, clones);

            default:
                return formatResponse(404, 'Action not found');
        }
    } catch (error) {
        console.error(error);
        return formatResponse(500, { error: error.message });
    }
};