const Airtable = require('airtable');
// Secure environment variable loading debug
if (process.env.NODE_ENV !== 'production') {
    console.log("Checking environment variables...");
    console.log("BASE_ID:", process.env.BASE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("AIRTABLE_API_KEY:", process.env.AIRTABLE_API_KEY ? "✅ Loaded" : "❌ MISSING");
}
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.BASE_ID);

exports.handler = async (event) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log("Received request:", {
            method: event.httpMethod,
            path: event.path,
            queryParams: event.queryStringParameters,
            headers: event.headers
        });
    }

    // Consistent query parameter parsing
    const { action, testNumber, questionNumber, questionId, skillId, testNumbersJson } = event.queryStringParameters || {};

    if (process.env.NODE_ENV !== 'production') {
        console.log("Action requested:", action);
    }

    // Consistent formatResponse function
    const formatResponse = (statusCode, body) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log("Sending response:", { statusCode, body });
        }
        return {
            statusCode,
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        };
    };

    try {
        switch (action) {
            case 'getTestNumbers':
                if (process.env.NODE_ENV !== 'production') {
                    console.log("Returning hardcoded test numbers...");
                }
                const testNumbers = [
                    'A9',
                    'A10',
                    'A11',
                    'B02',
                    'B04',
                    'D06',
                    'Z04',
                    'Z15'
                ];
                if (process.env.NODE_ENV !== 'production') {
                    console.log("Final sorted test numbers:", testNumbers);
                }
                return formatResponse(200, testNumbers);

            case 'getQuestionNumbers':
                if (!testNumber) return formatResponse(400, { error: 'Missing testNumber' });
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Generating question numbers 1-60 for test: ${testNumber}`);
                }
                const questionNumbers = Array.from({length: 60}, (_, i) => (i + 1).toString());
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Returning ${questionNumbers.length} question numbers`);
                }
                return formatResponse(200, questionNumbers);

            case 'getQuestionDetails':
                if (!testNumber || !questionNumber) return formatResponse(400, { error: 'Missing testNumber or questionNumber' });
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Fetching Question Details for Test: ${testNumber}, Question: ${questionNumber}`);
                }
                const filterFormula = `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`;
                if (process.env.NODE_ENV !== 'production') {
                    console.log('Using filter formula:', filterFormula);
                }
                const question = await base.table(process.env.QUESTIONS_TABLE_ID)
                    .select({
                        filterByFormula: filterFormula,
                        fields: ['Photo', 'Record ID', 'KatexMarkdown', 'Diagrams', 'Test Number', 'Question Number']
                    })
                    .firstPage()
                    .then(records => {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Found records:', records ? records.length : 0);
                            if (records && records.length > 0) {
                                console.log('First record fields:', {
                                    testNumber: records[0].get('Test Number'),
                                    questionNumber: records[0].get('Question Number'),
                                    katex: records[0].get('KatexMarkdown') ? 'present' : 'missing'
                                });
                            }
                        }
                        if (!records[0]) return null;
                        let katexContent = records[0].get('KatexMarkdown');
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Raw KaTeX content:', katexContent);
                        }
                        if (katexContent) {
                            katexContent = katexContent.trim();
                        }
                        const response = {
                            id: records[0].get('Record ID'),
                            photo: records[0].get('Photo'),
                            katex: katexContent,
                            diagrams: records[0].get('Diagrams')
                        };
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Sending response:', response);
                        }
                        return response;
                    });
                if (!question) return formatResponse(404, { error: 'Question not found' });
                return formatResponse(200, question);

            case 'getCorrectAnswer':
                if (!testNumber || !questionNumber) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Missing parameters:', { testNumber, questionNumber });
                    }
                    return formatResponse(400, { error: 'Test number and question number are required' });
                }
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Fetching correct answer for Test: ${testNumber}, Question: ${questionNumber}`);
                }
                try {
                    const records = await base.table(process.env.QUESTIONS_TABLE_ID)
                        .select({
                            filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                            fields: ['Test Number', 'Question Number', 'Answer']
                        })
                        .firstPage();
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Found records:', records.map(r => ({
                            testNum: r.get('Test Number'),
                            questionNum: r.get('Question Number'),
                            answer: r.get('Answer')
                        })));
                    }
                    if (!records || records.length === 0) {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('No records found');
                        }
                        return formatResponse(404, { error: 'Question not found' });
                    }
                    const correctAnswer = records[0].get('Answer');
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Found correct answer: ${correctAnswer}`);
                    }
                    return formatResponse(200, { correctAnswer });
                } catch (error) {
                    console.error('[getCorrectAnswer Error]:', error);
                    return formatResponse(500, { message: 'Server Error. Please try again later.' });
                }

            case 'getExplanation':
                if (!testNumber || !questionNumber) {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Missing parameters:', { testNumber, questionNumber });
                    }
                    return formatResponse(400, { error: 'Test number and question number are required' });
                }
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Fetching explanation for Test: ${testNumber}, Question: ${questionNumber}`);
                }
                try {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Querying Airtable with filter:', `AND({Test Number} = '${testNumber}', {Question Number} = '${questionNumber}')`);
                    }
                    const records = await base.table(process.env.QUESTIONS_TABLE_ID)
                        .select({
                            filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = '${questionNumber}')`,
                            fields: ['Test Number', 'Question Number', 'Explanation 4o']
                        })
                        .firstPage();
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Raw records:', records);
                        console.log('Records length:', records ? records.length : 0);
                    }
                    if (!records || records.length === 0) {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('No records found');
                        }
                        return formatResponse(404, { error: 'Question not found' });
                    }
                    const record = records[0];
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('First record fields:', record.fields);
                    }
                    let explanation = record.get('Explanation 4o');
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Raw explanation:', explanation);
                        console.log(`Found explanation: ${explanation ? 'Yes' : 'No'}`);
                    }
                    if (!explanation) {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('No explanation found in record');
                        }
                        return formatResponse(404, { error: 'No explanation found' });
                    }
                    // Fix LaTeX escaping issues
                    explanation = explanation
                        .replace(/\\\\([^\\])/g, '\\$1')  // Fix double escaped backslashes
                        .replace(/\\{2,}/g, '\\')         // Fix multiple backslashes
                        .replace(/\\([^a-zA-Z{}\[\]])/g, '\\$1')  // Ensure proper escaping of special characters
                        .replace(/You can't use 'macro parameter charact/g, '') // Remove error message
                        .trim();
                    // Clean up any remaining LaTeX issues
                    explanation = explanation
                        .replace(/\\\s+/g, '\\') // Remove spaces after backslashes
                        .replace(/\s*\n\s*/g, '\n') // Clean up newlines
                        .replace(/\n{3,}/g, '\n\n'); // Reduce multiple newlines
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Processed explanation:', explanation);
                    }
                    return formatResponse(200, { explanation });
                } catch (error) {
                    console.error('[getExplanation Error]:', error);
                    return formatResponse(500, { message: 'Server Error. Please try again later.' });
                }

            case 'getCloneQuestions':
                if (!testNumber || !questionNumber) {
                    console.error("[getCloneQuestions Error]: Missing testNumber or questionNumber in request:", event.queryStringParameters);
                    return formatResponse(400, { error: "Missing testNumber or questionNumber" });
                }
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`✅ Fetching clones for Test: ${testNumber}, Question: ${questionNumber}`);
                }
                try {
                    // First check if the question exists and get its Record ID
                    const questionExists = await base.table(process.env.QUESTIONS_TABLE_ID)
                        .select({
                            filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                            fields: ['Record ID']
                        })
                        .firstPage();
                    if (!questionExists || questionExists.length === 0) {
                        console.error("[getCloneQuestions Error]: Original question not found");
                        return formatResponse(404, { error: "Original question not found" });
                    }
                    const originalRecordId = questionExists[0].get('Record ID');
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Original question Record ID:', originalRecordId);
                    }
                    // Find all CopyCats where Original Question contains the record ID
                    const records = await base.table(process.env.COPYCATS_TABLE_ID)
                        .select({
                            filterByFormula: `FIND('${originalRecordId}', ARRAYJOIN({Original Question})) > 0`,
                            fields: ['Corrected Clone Question LM', 'AI Model', 'Original Question']
                        })
                        .all();
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`📌 Found ${records.length} total records`);
                        records.forEach(r => {
                            const fields = r.fields;
                            console.log(`Record details:\n  Original Question: ${fields['Original Question']}\n  Has Clone Question: ${Boolean(fields['Corrected Clone Question LM'])}\n  AI Model: ${fields['AI Model'] || 'No Model'}`);
                        });
                    }
                    const clones = records
                        .filter(r => r.get('Corrected Clone Question LM'))
                        .map(r => ({
                            clone: r.get('Corrected Clone Question LM'),
                            model: r.get('AI Model') || 'No Model',
                            originalQuestion: r.get('Original Question')
                        }));
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`✅ Returning ${clones.length} valid clones`);
                    }
                    return formatResponse(200, clones);
                } catch (error) {
                    console.error('[getCloneQuestions Error]:', error);
                    return formatResponse(500, { message: 'Server Error. Please try again later.' });
                }

            case 'getSkills':
                try {
                    const records = await base.table(process.env.SKILLS_TABLE_ID).select({
                        fields: ['Record ID', 'Name'],
                    }).all();
                    const skills = records
                        .map(record => ({
                            id: record.id,
                            name: record.get('Name')
                        }))
                        .filter(skill => !!skill.name)
                        .sort((a, b) => a.name.localeCompare(b.name));
                    if (skills.length === 0) {
                        return formatResponse(404, { error: 'No skills found' });
                    }
                    return formatResponse(200, skills);
                } catch (error) {
                    console.error('[getSkills Error]:', error);
                    return formatResponse(500, { message: 'Server Error. Please try again later.' });
                }

            case 'getWorksheetQuestions':
                try {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log("Fetching worksheet questions...");
                        console.log(`Attempting to fetch Skill record with ID: ${skillId}`);
                    }

                    // Fetch the skill record
                    const skillRecord = await base.table(process.env.SKILLS_TABLE_ID)
                        .find(skillId)
                        .catch(error => {
                            console.error("Error fetching skill record:", error);
                            throw new Error("Failed to fetch skill record.");
                        });

                    if (!skillRecord) {
                        return formatResponse(404, { message: "Skill not found." });
                    }

                    const linkedQuestionIds = skillRecord.fields.LinkedQuestions || [];
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Linked Question IDs: ${JSON.stringify(linkedQuestionIds)}`);
                    }

                    if (linkedQuestionIds.length === 0) {
                        return formatResponse(200, { questions: [] });
                    }

                    const fetchedQuestions = await Promise.all(
                        linkedQuestionIds.map(async (questionId) => {
                            try {
                                const record = await base.table(process.env.QUESTIONS_TABLE_ID).find(questionId);
                                return {
                                    id: record.id,
                                    photo: record.fields['Photo'] ? record.fields['Photo'][0].url : "No Photo Available",
                                    testNumber: record.fields['Test Number'] || "No Test Number",
                                    questionNumber: record.fields['Question Number'] || "No Question Number",
                                    katex: record.fields['KatexMarkdown'] || 'No Katex Content',
                                };
                            } catch (error) {
                                console.error(`Error fetching question with ID ${questionId}:`, error);
                                return { error: `Failed to fetch question with ID ${questionId}`, details: error.message };
                            }
                        })
                    );

                    const validQuestions = fetchedQuestions.filter(q => q !== null && !q.error);

                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Successfully fetched ${validQuestions.length} questions.`);
                    }

                    return formatResponse(200, { questions: validQuestions });
                } catch (error) {
                    console.error('Error in getWorksheetQuestions:', error);
                    return formatResponse(500, {
                        message: 'Failed to fetch worksheet questions.',
                        details: error.message,
                        suggestion: 'Check API Key, Base ID, and Table Permissions.'
                    });
                }

            case 'getWorksheetClones':
                if (!testNumbersJson) {
                    return formatResponse(400, { error: 'Test numbers are required' });
                }
                try {
                    const testNumbersList = JSON.parse(testNumbersJson);
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Fetching clones for test numbers:', testNumbersList);
                    }
                    const originalQuestionFormulas = testNumbersList.map(({ testNum, questionNum }) =>
                        `{Original Question} = '${testNum} - ${questionNum}'`
                    );
                    const filterFormula = `OR(${originalQuestionFormulas.join(',')})`;
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Clone filter formula:', filterFormula);
                    }
                    const cloneRecords = await base.table(process.env.COPYCATS_TABLE_ID)
                        .select({
                            maxRecords: 10,
                            filterByFormula: filterFormula,
                            fields: [
                                'Corrected Clone Question LM',
                                'Original Question',
                                'Model'
                            ]
                        })
                        .firstPage();
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Found ${cloneRecords.length} clone records`);
                    }
                    const cloneQuestions = cloneRecords
                        .filter(clone => clone.get('Corrected Clone Question LM'))
                        .map(clone => ({
                            id: clone.id,
                            clone: clone.get('Corrected Clone Question LM'),
                            model: clone.get('Model') || 'AI Generated',
                            originalQuestion: clone.get('Original Question')
                        }));
                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Processed ${cloneQuestions.length} valid clones`);
                    }
                    return formatResponse(200, { questions: cloneQuestions });
                } catch (error) {
                    console.error('[getWorksheetClones Error]:', error);
                    return formatResponse(500, { message: 'Server Error. Please try again later.' });
                }

            default:
                if (process.env.NODE_ENV !== 'production') {
                    console.log("Invalid action:", action);
                }
                return formatResponse(404, { error: 'Action not found' });
        }
    } catch (error) {
        console.error('[Airtable API Error]:', error);
        return formatResponse(500, { message: 'Server Error. Please try again later.' });
    }
};
