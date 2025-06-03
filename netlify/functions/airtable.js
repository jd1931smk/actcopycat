const Airtable = require('airtable');
// Secure environment variable loading debug
if (process.env.NODE_ENV !== 'production') {
    console.log("Checking environment variables...");
    console.log("ACT_BASE_ID:", process.env.ACT_BASE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("SAT_BASE_ID:", process.env.SAT_BASE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("DRK_BASE_ID:", process.env.DRK_BASE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("AIRTABLE_API_KEY:", process.env.AIRTABLE_API_KEY ? "✅ Loaded" : "❌ MISSING");
    console.log("SKILLS_TABLE_ID:", process.env.SKILLS_TABLE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("QUESTIONS_TABLE_ID:", process.env.QUESTIONS_TABLE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("COPYCATS_TABLE_ID:", process.env.COPYCATS_TABLE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("SAT_SKILLS_TABLE_ID:", process.env.SAT_SKILLS_TABLE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("SAT_QUESTIONS_TABLE_ID:", process.env.SAT_QUESTIONS_TABLE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("DRK_PANDA_SKILLS_TABLE_ID:", process.env.DRK_PANDA_SKILLS_TABLE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("DRK_QUESTIONS_TABLE_ID:", process.env.DRK_QUESTIONS_TABLE_ID ? "✅ Loaded" : "❌ MISSING");
}

// Initialize bases for ACT, SAT, and DRK
const actBase = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.ACT_BASE_ID);
const satBase = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.SAT_BASE_ID);
const drkBase = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.DRK_BASE_ID);

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
    const { action, testNumber, questionNumber, questionId, skillId, testNumbersJson, database = 'ACT' } = event.queryStringParameters || {};

    // Select the appropriate base based on the database parameter
    let base;
    switch(database) {
        case 'SAT':
            base = satBase;
            break;
        case 'DRK':
            base = drkBase;
            break;
        default:
            base = actBase;
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log("Action requested:", action);
        console.log("Database selected:", database);
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
                // Note: Hardcoded ACT test numbers. If SAT tests are needed, this needs adjustment.
                if (process.env.NODE_ENV !== 'production') {
                    console.log("Returning hardcoded ACT test numbers...");
                }
                // If SAT tests have different numbering, this case needs to be dynamic based on 'database'
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
                 // Note: Hardcoded 1-60 question numbers. If SAT questions have different numbering, this needs adjustment.
                if (!testNumber) return formatResponse(400, { error: 'Missing testNumber' });
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Generating question numbers 1-60 for test: ${testNumber} (assuming ACT format)`);
                }
                 // If SAT questions have different numbering, this case needs to be dynamic based on 'database'
                const questionNumbers = Array.from({length: 60}, (_, i) => (i + 1).toString());
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Returning ${questionNumbers.length} question numbers`);
                }
                return formatResponse(200, questionNumbers);

            case 'getQuestionDetails':
                if (!testNumber || !questionNumber) return formatResponse(400, { error: 'Missing testNumber or questionNumber' });
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Fetching Question Details for Test: ${testNumber}, Question: ${questionNumber} from ${database} database`);
                }
                const detailsFilterFormula = `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`;
                const questionsTableIdDetails = database === 'SAT' ? process.env.SAT_QUESTIONS_TABLE_ID : process.env.QUESTIONS_TABLE_ID;
                if (!questionsTableIdDetails) {
                     console.error('[getQuestionDetails Error]: Questions table ID is not defined for database:', database);
                     return formatResponse(500, { message: 'Questions table ID not configured for this database.' });
                }
                if (process.env.NODE_ENV !== 'production') {
                    console.log('Using filter formula:', detailsFilterFormula);
                    console.log('Using questions table ID:', questionsTableIdDetails);
                }
                const question = await base.table(questionsTableIdDetails)
                    .select({
                        filterByFormula: detailsFilterFormula,
                        fields: ['Photo', 'Record ID', 'LatexMarkdown', 'Diagram', 'Test Number', 'Question Number']
                    })
                    .firstPage()
                    .then(records => {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Found records:', records ? records.length : 0);
                            if (records && records.length > 0) {
                                console.log('First record fields:', {
                                    testNumber: records[0].get('Test Number'),
                                    questionNumber: records[0].get('Question Number'),
                                    katex: records[0].get('LatexMarkdown') ? 'present' : 'missing'
                                });
                            }
                        }
                        if (!records[0]) return null;
                        let katexContent = records[0].get('LatexMarkdown');
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
                            diagram: records[0].get('Diagram')
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
                    console.log(`Fetching correct answer for Test: ${testNumber}, Question: ${questionNumber} from ${database} database`);
                }
                try {
                    const questionsTableIdAnswer = database === 'SAT' ? process.env.SAT_QUESTIONS_TABLE_ID : process.env.QUESTIONS_TABLE_ID;
                    if (!questionsTableIdAnswer) {
                         console.error('[getCorrectAnswer Error]: Questions table ID is not defined for database:', database);
                         return formatResponse(500, { message: 'Questions table ID not configured for this database.' });
                    }
                    const records = await base.table(questionsTableIdAnswer)
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
                    console.log(`Fetching explanation for Test: ${testNumber}, Question: ${questionNumber} from ${database} database`);
                }
                try {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Querying Airtable with filter:', `AND({Test Number} = '${testNumber}', {Question Number} = '${questionNumber}')`);
                    }
                    const questionsTableIdExplanation = database === 'SAT' ? process.env.SAT_QUESTIONS_TABLE_ID : process.env.QUESTIONS_TABLE_ID;
                     if (!questionsTableIdExplanation) {
                         console.error('[getExplanation Error]: Questions table ID is not defined for database:', database);
                         return formatResponse(500, { message: 'Questions table ID not configured for this database.' });
                    }
                    const records = await base.table(questionsTableIdExplanation)
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
                // Clones are not available for the SAT database yet
                if (database === 'SAT') {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Skipping getCloneQuestions for SAT database as clones are not available.');
                    }
                    return formatResponse(200, []); // Return empty array for SAT
                }

                if (!testNumber || !questionNumber) {
                    console.error("[getCloneQuestions Error]: Missing testNumber or questionNumber in request:", event.queryStringParameters);
                    return formatResponse(400, { error: "Missing testNumber or questionNumber" });
                }
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`✅ Fetching clones for Test: ${testNumber}, Question: ${questionNumber} from ${database} database`);
                }
                try {
                    // First check if the question exists and get its Record ID from the correct questions table
                    const questionsTableIdClones = database === 'SAT' ? process.env.SAT_QUESTIONS_TABLE_ID : process.env.QUESTIONS_TABLE_ID;
                    if (!questionsTableIdClones) {
                         console.error('[getCloneQuestions Error]: Questions table ID is not defined for database:', database);
                         return formatResponse(500, { message: 'Questions table ID not configured for this database.' });
                    }

                    const questionExists = await base.table(questionsTableIdClones)
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
                    // Find all CopyCats where Original Question contains the record ID (only for ACT)
                    const copycatsTableId = process.env.COPYCATS_TABLE_ID; // Only ACT CopyCats table exists
                    if (!copycatsTableId) {
                         console.error('[getCloneQuestions Error]: CopyCats table ID is not defined.');
                         // Note: We might want to return an empty array here instead of a 500 error if the absence of the table is expected.
                         // For now, keeping 500 as missing env var is likely config error.
                         return formatResponse(500, { message: 'CopyCats table ID not configured.' });
                    }

                    const records = await base.table(copycatsTableId)
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
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Fetching skills from ${database} database`);
                }
                let skillsTableId;
                switch(database) {
                    case 'SAT':
                        skillsTableId = process.env.SAT_SKILLS_TABLE_ID;
                        break;
                    case 'DRK':
                        skillsTableId = process.env.DRK_PANDA_SKILLS_TABLE_ID;
                        break;
                    default:
                        skillsTableId = process.env.SKILLS_TABLE_ID;
                }
                
                if (!skillsTableId) {
                    console.error('[getSkills Error]: Skills table ID is not defined for database:', database);
                    return formatResponse(500, { message: 'Skills table ID not configured for this database.' });
                }

                const skills = await base.table(skillsTableId)
                    .select({
                        fields: ['Name', 'Record ID']
                    })
                    .all()
                    .then(records => records.map(record => ({
                        id: record.get('Record ID'),
                        name: record.get('Name')
                    })));

                return formatResponse(200, skills);

            case 'getWorksheetQuestions':
                if (!skillId) return formatResponse(400, { error: 'Missing skillId' });
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Fetching worksheet questions for skill: ${skillId} from ${database} database`);
                }

                let questionsTableId;
                let filterFormula;
                let fields;

                switch(database) {
                    case 'SAT':
                        questionsTableId = process.env.SAT_QUESTIONS_TABLE_ID;
                        filterFormula = `{Skill ID} = '${skillId}'`;
                        fields = ['Test Number', 'Question Number', 'Photo', 'LatexMarkdown', 'Answer', 'Record ID', 'Skill ID'];
                        break;
                    case 'DRK':
                        questionsTableId = process.env.DRK_QUESTIONS_TABLE_ID;
                        filterFormula = `FIND('${skillId}', ARRAYJOIN({Skill}))`;
                        fields = ['Question Number', 'Photo', 'Katex Markdown', 'Name', 'Record ID', 'Skill'];
                        break;
                    default:
                        questionsTableId = process.env.QUESTIONS_TABLE_ID;
                        filterFormula = `{Skill ID} = '${skillId}'`;
                        fields = ['Test Number', 'Question Number', 'Photo', 'LatexMarkdown', 'Answer', 'Record ID', 'Skill ID'];
                }

                if (!questionsTableId) {
                    console.error('[getWorksheetQuestions Error]: Questions table ID is not defined for database:', database);
                    return formatResponse(500, { message: 'Questions table ID not configured for this database.' });
                }

                try {
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('Using filter formula:', filterFormula);
                        console.log('Using fields:', fields);
                    }

                    const records = await base.table(questionsTableId)
                        .select({
                            filterByFormula: filterFormula,
                            fields: fields
                        })
                        .all();

                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`Found ${records.length} questions for skill ${skillId}`);
                    }

                    const questions = records.map(record => {
                        if (database === 'DRK') {
                            return {
                                id: record.get('Record ID'),
                                questionNumber: record.get('Question Number'),
                                photo: record.get('Photo'),
                                latex: record.get('Katex Markdown'),
                                name: record.get('Name'),
                                skillId: record.get('Skill')
                            };
                        } else {
                            return {
                                id: record.get('Record ID'),
                                testNumber: record.get('Test Number'),
                                questionNumber: record.get('Question Number'),
                                photo: record.get('Photo'),
                                latex: record.get('LatexMarkdown'),
                                answer: record.get('Answer'),
                                skillId: record.get('Skill ID')
                            };
                        }
                    });

                    // Get the skill name
                    let skillsTableId;
                    let skillNameField = 'Name';
                    switch(database) {
                        case 'SAT':
                            skillsTableId = process.env.SAT_SKILLS_TABLE_ID;
                            break;
                        case 'DRK':
                            skillsTableId = process.env.DRK_PANDA_SKILLS_TABLE_ID;
                            skillNameField = 'Name';
                            break;
                        default:
                            skillsTableId = process.env.SKILLS_TABLE_ID;
                    }

                    const skillRecord = await base.table(skillsTableId)
                        .select({
                            filterByFormula: `{Record ID} = '${skillId}'`,
                            fields: [skillNameField]
                        })
                        .firstPage();

                    const skillName = skillRecord[0]?.get(skillNameField) || '';

                    return formatResponse(200, { questions, skillName });
                } catch (error) {
                    console.error('[getWorksheetQuestions Error]:', error);
                    return formatResponse(500, { message: 'Server Error. Please try again later.' });
                }

            case 'getWorksheetClones':
                 // This action is specifically for fetching clones for a worksheet, which are currently only in the ACT CopyCats table
                 // If the request is for the SAT database, return an empty list
                if (database === 'SAT') {
                    if (process.env.NODE_ENV !== 'production') {
                         console.log('Skipping getWorksheetClones for SAT database as clones are not available.');
                    }
                     return formatResponse(200, { questions: [] });
                 }

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
                    const copycatsTableIdClones = process.env.COPYCATS_TABLE_ID;
                     if (!copycatsTableIdClones) {
                         console.error('[getWorksheetClones Error]: CopyCats table ID is not defined.');
                         return formatResponse(500, { message: 'CopyCats table ID not configured.' });
                     }

                    const cloneRecords = await base.table(copycatsTableIdClones)
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
