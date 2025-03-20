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
                console.log("Fetching Test Numbers...");
                const testNumbers = await base('Questions')
                    .select({ fields: ['Test Number'] })
                    .all()
                    .then(records => {
                        console.log("Raw Records:", records.map(r => r.fields));
                        return [...new Set(records.map(r => r.get('Test Number')).filter(Boolean))]
                            .sort((a, b) => {
                                // Extract numeric parts
                                const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                                const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                                
                                if (numA === numB) {
                                    return a.localeCompare(b); // Fall back to string comparison if numbers are equal
                                }
                                return numA - numB;
                            });
                    });
                return formatResponse(200, testNumbers);

            case 'getQuestionNumbers':
                if (!testNumber) return formatResponse(400, 'Missing testNumber');
                console.log(`Fetching Question Numbers for Test: ${testNumber}`);
                
                const questionNumbers = await base('Questions')
                    .select({ 
                        filterByFormula: `{Test Number} = '${testNumber}'`,
                        fields: ['Question Number']
                    })
                    .all()
                    .then(records => {
                        return records
                            .map(r => {
                                const num = r.get('Question Number');
                                if (!num) return null;
                                return parseInt(num, 10);
                            })
                            .filter(num => num !== null && !isNaN(num))
                            .sort((a, b) => a - b);
                    });

                return formatResponse(200, questionNumbers);

            case 'getQuestionDetails':
                if (!testNumber || !questionNumber) return formatResponse(400, 'Missing testNumber or questionNumber');
                console.log(`Fetching Question Details for Test: ${testNumber}, Question: ${questionNumber}`);
                const question = await base('Questions')
                    .select({
                        filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                        fields: ['Photo', 'Record ID', 'LaTeX', 'LatexMarkdown', 'Question Text']
                    })
                    .firstPage()
                    .then(records => {
                        if (!records || records.length === 0) return null;
                        const record = records[0];
                        const photo = record.get('Photo');
                        return {
                            id: record.get('Record ID'),
                            photo: photo ? photo[0].url : null,
                            latex: record.get('LaTeX') || record.get('LatexMarkdown') || record.get('Question Text'),
                            questionText: record.get('Question Text')
                        };
                    });
                if (!question) return formatResponse(404, 'Question not found');
                console.log('Returning question details:', question);
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
                        .trim();

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
                
                // More flexible matching - try both exact and flexible formats
                const filterFormula = `OR(
                    {Original Question} = '${testNumber} - ${questionNumber}',
                    {Original Question} = '${testNumber}-${questionNumber}',
                    {Original Question} = '${testNumber} ${questionNumber}'
                )`;

                try {
                    const records = await base('CopyCats')
                        .select({
                            filterByFormula: filterFormula,
                            fields: ['Corrected Clone Question LM', 'AI Model', 'Original Question']
                        })
                        .all();

                    console.log(`📌 Found ${records.length} total records`);
                    
                    // Log details about each record
                    records.forEach(r => {
                        const fields = r.fields;
                        console.log(`Record details:
                            Original Question: ${fields['Original Question']}
                            Has Clone Question: ${Boolean(fields['Corrected Clone Question LM'])}
                            AI Model: ${fields['AI Model'] || 'No Model'}
                        `);
                    });

                    const clones = records.map(r => ({
                        clone: r.get('Corrected Clone Question LM') || '',
                        model: r.get('AI Model') || 'No Model',
                        originalQuestion: r.get('Original Question') || ''
                    }));

                    // Log any skipped questions
                    const emptyClones = clones.filter(item => !item.clone);
                    if (emptyClones.length > 0) {
                        console.log(`⚠️ Found ${emptyClones.length} empty clone questions:`, emptyClones);
                    }

                    console.log(`✅ Returning ${clones.length} clones`);
                    return formatResponse(200, clones);
                } catch (error) {
                    console.error('Error fetching clones:', error);
                    return formatResponse(500, { error: error.message });
                }

            case 'getSkills':
                try {
                    console.log('Fetching skills from Skills table...');
                    console.log('Using BASE_ID:', process.env.BASE_ID);
                    
                    // Get all records from Skills table using the correct table ID
                    const records = await base('tbl6l9Pu2uHM2XlvV')
                        .select({
                            fields: ['Name']  // Just get the name field
                        })
                        .all();

                    console.log(`Found ${records.length} skills`);
                    console.log('Raw records:', records.map(r => ({ 
                        id: r.id, 
                        name: r.get('Name'),
                        fields: r.fields 
                    })));
                    
                    // Format the skills array
                    const skills = records
                        .map(record => ({
                            id: record.id,
                            name: record.get('Name') || 'Unknown Skill'
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));

                    console.log('Formatted skills:', skills);
                    
                    return formatResponse(200, skills);
                } catch (error) {
                    console.error('Error in getSkills:', error);
                    console.error('Error details:', error.message);
                    if (error.stack) console.error('Stack trace:', error.stack);
                    return formatResponse(500, { error: `Failed to fetch skills: ${error.message}` });
                }

            case 'getWorksheetQuestions':
                const { skillId } = event.queryStringParameters;
                console.log('Received parameters:', { skillId });

                if (!skillId) {
                    console.log('Missing required parameter: skillId');
                    return formatResponse(400, { error: 'Skill ID is required' });
                }

                try {
                    console.log(`Fetching questions for skill ${skillId}`);
                    
                    // First, get the skill and its linked questions
                    const skillRecords = await base('tbl6l9Pu2uHM2XlvV')
                        .select({
                            filterByFormula: `RECORD_ID() = '${skillId}'`,
                            fields: ['Name', 'Table 1']
                        })
                        .all();
                    
                    if (skillRecords.length === 0) {
                        console.log(`No skill found with ID: ${skillId}`);
                        return formatResponse(404, { error: 'Skill not found' });
                    }

                    const skillRecord = skillRecords[0];
                    const skillName = skillRecord.get('Name');
                    const linkedQuestions = skillRecord.get('Table 1') || [];
                    
                    console.log(`Found skill: ${skillName} with ${linkedQuestions.length} linked questions`);
                    
                    if (linkedQuestions.length === 0) {
                        console.log('No questions linked to this skill');
                        return formatResponse(404, { error: 'No questions found for this skill' });
                    }

                    // Get the actual question records
                    const records = await base('Questions')
                        .select({
                            filterByFormula: `OR(${linkedQuestions.map(id => `RECORD_ID() = '${id}'`).join(',')})`,
                            fields: [
                                'Photo', 
                                'LatexMarkdown',
                                'Test Number', 
                                'Question Number'
                            ]
                        })
                        .all();

                    console.log(`Found ${records.length} matching questions`);
                    
                    // Log details about the first few records
                    if (records.length > 0) {
                        console.log('First 3 records:');
                        records.slice(0, 3).forEach((record, i) => {
                            console.log(`Record ${i + 1}:`, {
                                id: record.id,
                                fields: record.fields,
                                testNumber: record.get('Test Number'),
                                questionNumber: record.get('Question Number')
                            });
                        });
                    }

                    // Randomly select up to 10 questions
                    const shuffled = records.sort(() => 0.5 - Math.random());
                    const selected = shuffled.slice(0, 10);

                    // Format the response
                    const questions = selected.map(record => {
                        const formatted = {
                            photo: record.get('Photo'),
                            latexMarkdown: record.get('LatexMarkdown'),
                            testNumber: record.get('Test Number'),
                            questionNumber: record.get('Question Number')
                        };
                        console.log('Formatted question:', formatted);
                        return formatted;
                    });

                    console.log(`Returning ${questions.length} questions`);
                    if (questions.length === 0) {
                        console.log('No questions found matching criteria.');
                        return formatResponse(404, { error: 'No questions found matching the selected skill.' });
                    }
                    
                    return formatResponse(200, questions);
                } catch (error) {
                    console.error('Error in getWorksheetQuestions:', error);
                    console.error('Error details:', error.message);
                    if (error.stack) console.error('Stack trace:', error.stack);
                    return formatResponse(500, { error: `Failed to fetch questions: ${error.message}` });
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
