const Airtable = require('airtable');

// Debugging: Log if environment variables are loaded
console.log("Checking environment variables...");
console.log("BASE_ID:", process.env.BASE_ID ? "✅ Loaded" : "❌ MISSING");
console.log("AIRTABLE_API_KEY:", process.env.AIRTABLE_API_KEY ? "✅ Loaded" : "❌ MISSING");

// Initialize Airtable with API Key
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.BASE_ID);

exports.handler = async (event) => {
    console.log("Received request:", {
        method: event.httpMethod,
        path: event.path,
        queryParams: event.queryStringParameters,
        headers: event.headers
    });

    const { action, testNumber, questionNumber, questionId } = event.queryStringParameters || {};

    // Log the action being requested
    console.log("Action requested:", action);

    // Helper function to format response
    const formatResponse = (statusCode, body) => {
        console.log("Sending response:", { statusCode, body });
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
                console.log("Returning hardcoded test numbers...");
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
                console.log("Final sorted test numbers:", testNumbers);
                return formatResponse(200, testNumbers);

            case 'getQuestionNumbers':
                if (!testNumber) return formatResponse(400, 'Missing testNumber');
                console.log(`Generating question numbers 1-60 for test: ${testNumber}`);
                
                // Generate array of numbers 1-60
                const questionNumbers = Array.from({length: 60}, (_, i) => (i + 1).toString());
                console.log(`Returning ${questionNumbers.length} question numbers`);
                
                return formatResponse(200, questionNumbers);

            case 'getQuestionDetails':
                if (!testNumber || !questionNumber) return formatResponse(400, 'Missing testNumber or questionNumber');
                console.log(`Fetching Question Details for Test: ${testNumber}, Question: ${questionNumber}`);
                
                // Create an array of possible test number formats
                const testFormats = [testNumber];
                console.log('Using test format:', testFormats);
                
                const filterFormula = `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`;
                console.log('Using filter formula:', filterFormula);
                
                const question = await base('Questions')
                    .select({
                        filterByFormula: filterFormula,
                        fields: ['Photo', 'Record ID', 'KatexMarkdown', 'Diagrams', 'Test Number', 'Question Number']
                    })
                    .firstPage()
                    .then(records => {
                        console.log('Found records:', records ? records.length : 0);
                        if (records && records.length > 0) {
                            console.log('First record fields:', {
                                testNumber: records[0].get('Test Number'),
                                questionNumber: records[0].get('Question Number'),
                                katex: records[0].get('KatexMarkdown') ? 'present' : 'missing'
                            });
                        }
                        
                        if (!records[0]) return null;
                        
                        let katexContent = records[0].get('KatexMarkdown');
                        console.log('Raw KaTeX content:', katexContent);
                        // Do not replace double backslashes; preserve original LaTeX
                        if (katexContent) {
                            katexContent = katexContent.trim();
                        }
                        
                        const response = {
                            id: records[0].get('Record ID'),
                            photo: records[0].get('Photo'),
                            katex: katexContent,
                            diagrams: records[0].get('Diagrams')
                        };
                        console.log('Sending response:', response);
                        return response;
                    });
                if (!question) return formatResponse(404, 'Question not found');
                return formatResponse(200, question);

            case 'getCorrectAnswer':
                if (!testNumber || !questionNumber) {
                    console.log('Missing parameters:', { testNumber, questionNumber });
                    return formatResponse(400, { error: 'Test number and question number are required' });
                }

                console.log(`Fetching correct answer for Test: ${testNumber}, Question: ${questionNumber}`);
                
                try {
                    const records = await base('Questions')
                        .select({
                            filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                            fields: ['Test Number', 'Question Number', 'Answer']
                        })
                        .firstPage();

                    console.log('Found records:', records.map(r => ({
                        testNum: r.get('Test Number'),
                        questionNum: r.get('Question Number'),
                        answer: r.get('Answer')
                    })));

                    if (!records || records.length === 0) {
                        console.log('No records found');
                        return formatResponse(404, { error: 'Question not found' });
                    }

                    const correctAnswer = records[0].get('Answer');
                    console.log(`Found correct answer: ${correctAnswer}`);

                    return formatResponse(200, { correctAnswer });
                } catch (error) {
                    console.error('Error in getCorrectAnswer:', error);
                    return formatResponse(500, { error: 'Failed to fetch correct answer' });
                }

            case 'getExplanation':
                if (!testNumber || !questionNumber) {
                    console.log('Missing parameters:', { testNumber, questionNumber });
                    return formatResponse(400, { error: 'Test number and question number are required' });
                }

                console.log(`Fetching explanation for Test: ${testNumber}, Question: ${questionNumber}`);
                
                try {
                    console.log('Querying Airtable with filter:', `AND({Test Number} = '${testNumber}', {Question Number} = '${questionNumber}')`);
                    
                    const records = await base('Questions')
                        .select({
                            filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = '${questionNumber}')`,
                            fields: ['Test Number', 'Question Number', 'Explanation 4o']
                        })
                        .firstPage();

                    console.log('Raw records:', records);
                    console.log('Records length:', records ? records.length : 0);

                    if (!records || records.length === 0) {
                        console.log('No records found');
                        return formatResponse(404, { error: 'Question not found' });
                    }

                    const record = records[0];
                    console.log('First record fields:', record.fields);
                    
                    let explanation = record.get('Explanation 4o');
                    console.log('Raw explanation:', explanation);
                    console.log(`Found explanation: ${explanation ? 'Yes' : 'No'}`);

                    if (!explanation) {
                        console.log('No explanation found in record');
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

                    console.log('Processed explanation:', explanation);

                    return formatResponse(200, { explanation });
                } catch (error) {
                    console.error('Error in getExplanation:', error);
                    console.error('Error details:', error.message);
                    if (error.stack) console.error('Stack trace:', error.stack);
                    return formatResponse(500, { error: 'Failed to fetch explanation' });
                }

            case 'getCloneQuestions':
                if (!testNumber || !questionNumber) {
                    console.error("❌ Missing testNumber or questionNumber in request:", event.queryStringParameters);
                    return formatResponse(400, { error: "Missing testNumber or questionNumber" });
                }

                console.log(`✅ Fetching clones for Test: ${testNumber}, Question: ${questionNumber}`);
                try {
                    // First check if the question exists and get its Record ID
                    const questionExists = await base('Questions')
                        .select({
                            filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                            fields: ['Record ID']
                        })
                        .firstPage();

                    if (!questionExists || questionExists.length === 0) {
                        console.error("❌ Original question not found");
                        return formatResponse(404, { error: "Original question not found" });
                    }

                    const originalRecordId = questionExists[0].get('Record ID');
                    console.log('Original question Record ID:', originalRecordId);

                    // Find all CopyCats where Original Question contains the record ID
                    const records = await base('CopyCats')
                        .select({
                            filterByFormula: `FIND('${originalRecordId}', ARRAYJOIN({Original Question})) > 0`,
                            fields: ['Corrected Clone Question LM', 'AI Model', 'Original Question']
                        })
                        .all();

                    console.log(`📌 Found ${records.length} total records`);
                    records.forEach(r => {
                        const fields = r.fields;
                        console.log(`Record details:\n  Original Question: ${fields['Original Question']}\n  Has Clone Question: ${Boolean(fields['Corrected Clone Question LM'])}\n  AI Model: ${fields['AI Model'] || 'No Model'}`);
                    });

                    const clones = records
                        .filter(r => r.get('Corrected Clone Question LM'))
                        .map(r => ({
                            clone: r.get('Corrected Clone Question LM'),
                            model: r.get('AI Model') || 'No Model',
                            originalQuestion: r.get('Original Question')
                        }));

                    console.log(`✅ Returning ${clones.length} valid clones`);
                    return formatResponse(200, clones);
                } catch (error) {
                    console.error('Error fetching clones:', error);
                    return formatResponse(500, { error: error.message });
                }

            case 'getSkills':
                try {
                    console.log('getSkills: Fetching from Skill table...');
                    const records = await base('Skill').select({
                        fields: ['Name'],
                        maxRecords: 100
                    }).firstPage();

                    // Filter out records with no Name
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
                    console.error('getSkills: Fatal error:', error);
                    return formatResponse(500, { error: 'Failed to fetch skills', details: error.message });
                }

            case 'getWorksheetQuestions':
                const { skillId, includeClones } = event.queryStringParameters;
                console.log('Received parameters:', { skillId, includeClones });

                if (!skillId) {
                    console.log('Missing required parameter: skillId');
                    return formatResponse(400, { error: 'Skill ID is required' });
                }

                try {
                    // Fetch the skill name from the Skill table
                    let skillName = '';
                    try {
                        const skillRecord = await base('Skill').find(skillId);
                        skillName = skillRecord.get('Name');
                    } catch (err) {
                        console.warn('Could not fetch skill name for skillId:', skillId, err);
                    }

                    console.log(`Fetching questions for skill ID ${skillId}`);
                    // Get questions that have this skill (linked record by ID)
                    const questionRecords = await base('tbllwZpPeh9yHJ3fM')
                        .select({
                            maxRecords: 5,
                            filterByFormula: `FIND(\"${skillId}\", ARRAYJOIN({Skill})) > 0`,
                            fields: [
                                'Photo', 
                                'KatexMarkdown',
                                'Test Number', 
                                'Question Number',
                                'Answer'
                            ]
                        })
                        .firstPage();

                    console.log(`Found ${questionRecords.length} questions with skill ID: ${skillId}`);

                    let allQuestions = questionRecords.map(record => ({
                        id: record.id,
                        photo: record.get('Photo'),
                        latexMarkdown: record.get('KatexMarkdown'),
                        testNumber: record.get('Test Number'),
                        questionNumber: record.get('Question Number'),
                        answer: record.get('Answer'),
                        isClone: false
                    }));

                    // Return immediately if we don't need clones or have no original questions
                    if (includeClones !== 'true' || questionRecords.length === 0) {
                        return formatResponse(200, {
                            skillId,
                            skillName,
                            questions: allQuestions,
                            hasMoreQuestions: true // Indicate that clones can be loaded separately
                        });
                    }

                    return formatResponse(200, {
                        skillId,
                        skillName,
                        questions: allQuestions,
                        hasMoreQuestions: true // Indicate that clones can be loaded separately
                    });
                } catch (error) {
                    console.error('Error in getWorksheetQuestions:', error);
                    console.error('Error details:', error.message);
                    if (error.stack) console.error('Stack trace:', error.stack);
                    return formatResponse(500, { error: `Failed to fetch questions: ${error.message}` });
                }

            case 'getWorksheetClones':
                const { testNumbersJson } = event.queryStringParameters;
                if (!testNumbersJson) {
                    return formatResponse(400, { error: 'Test numbers are required' });
                }

                try {
                    const testNumbersList = JSON.parse(testNumbersJson);
                    console.log('Fetching clones for test numbers:', testNumbersList);

                    // Create an OR formula for all original questions
                    const originalQuestionFormulas = testNumbersList.map(({ testNum, questionNum }) => 
                        `{Original Question} = '${testNum} - ${questionNum}'`
                    );
                    
                    const filterFormula = `OR(${originalQuestionFormulas.join(',')})`;
                    console.log('Clone filter formula:', filterFormula);

                    const cloneRecords = await base('tblpE46FDmB0LmeTU')
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

                    console.log(`Found ${cloneRecords.length} clone records`);

                    const cloneQuestions = cloneRecords
                        .filter(clone => clone.get('Corrected Clone Question LM'))
                        .map(clone => ({
                            id: clone.id,
                            clone: clone.get('Corrected Clone Question LM'),
                            model: clone.get('Model') || 'AI Generated',
                            originalQuestion: clone.get('Original Question')
                        }));

                    console.log(`Processed ${cloneQuestions.length} valid clones`);
                    return formatResponse(200, { questions: cloneQuestions });
                } catch (error) {
                    console.error('Error fetching clones:', error);
                    return formatResponse(500, { error: error.message });
                }

            default:
                console.log("Invalid action:", action);
                return formatResponse(404, 'Action not found');
        }
    } catch (error) {
        console.error("Airtable API Error:", error);
        return formatResponse(500, { error: error.message });
    }
};
