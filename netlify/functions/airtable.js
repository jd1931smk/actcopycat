const Airtable = require('airtable');
// Secure environment variable loading debug
if (process.env.NODE_ENV !== 'production') {
    console.log("Checking environment variables...");
    console.log("ACT_BASE_ID:", process.env.ACT_BASE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("SAT_BASE_ID:", process.env.SAT_BASE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("DRK_BASE_ID:", process.env.DRK_BASE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("AIRTABLE_API_KEY:", process.env.AIRTABLE_API_KEY ? "✅ Loaded" : "❌ MISSING");
    console.log("SKILLS_TABLE_ID:", process.env.SKILLS_TABLE_ID ? "✅ Loaded" : "❌ MISSING");
    console.log("PANDA_SKILLS_TABLE_ID:", process.env.PANDA_SKILLS_TABLE_ID ? "✅ Loaded" : "❌ MISSING");
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
    const { action, testNumber, questionNumber, questionId, skillId, pandaSkillId, testNumbersJson, database = 'ACT' } = event.queryStringParameters || {};

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
                if (process.env.NODE_ENV !== 'production') {
                    console.log("Fetching test numbers from database...");
                }
                try {
                    const questionsTableId = process.env.QUESTIONS_TABLE_ID;
                    if (!questionsTableId) {
                        console.error('[getTestNumbers Error]: Questions table ID is not defined');
                        return formatResponse(500, { message: 'Questions table ID not configured.' });
                    }

                    const records = await actBase.table(questionsTableId)
                        .select({
                            fields: ['Test Number'],
                            sort: [{ field: 'Test Number', direction: 'asc' }]
                        })
                        .all();

                    // Extract unique test numbers
                    const testNumbers = [...new Set(records.map(record => record.get('Test Number')))];

                    if (process.env.NODE_ENV !== 'production') {
                        console.log("Final test numbers:", testNumbers);
                    }
                    return formatResponse(200, testNumbers);
                } catch (error) {
                    console.error('[getTestNumbers Error]:', error);
                    return formatResponse(500, { message: 'Failed to fetch test numbers' });
                }

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
                        fields: ['Photo', 'PNG', 'Record ID', 'LatexMarkdown', 'Diagrams', 'Test Number', 'Question Number']
                    })
                    .firstPage()
                    .then(records => {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Found records:', records ? records.length : 0);
                            if (records && records.length > 0) {
                                console.log('First record fields:', {
                                    testNumber: records[0].get('Test Number'),
                                    questionNumber: records[0].get('Question Number'),
                                    katex: records[0].get('LatexMarkdown') ? 'present' : 'missing',
                                    png: records[0].get('PNG') ? 'present' : 'missing',
                                    photo: records[0].get('Photo') ? 'present' : 'missing',
                                    diagrams: records[0].get('Diagrams') ? 'present' : 'missing'
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
                        
                        // Handle image fields - PNG takes priority over Photo
                        let imageUrl = null;
                        const pngField = records[0].get('PNG');
                        const photoField = records[0].get('Photo');
                        
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Raw PNG field:', pngField);
                            console.log('Raw Photo field:', photoField);
                        }
                        
                        // Check PNG field first
                        if (pngField && Array.isArray(pngField) && pngField.length > 0) {
                            imageUrl = pngField[0].url;
                            if (process.env.NODE_ENV !== 'production') {
                                console.log('Using PNG field for image:', imageUrl);
                            }
                        }
                        // Fall back to Photo field if PNG is empty
                        else if (photoField && Array.isArray(photoField) && photoField.length > 0) {
                            imageUrl = photoField[0].url;
                            if (process.env.NODE_ENV !== 'production') {
                                console.log('Falling back to Photo field for image:', imageUrl);
                            }
                        }
                        
                        // Handle Diagrams field - Airtable attachments come as arrays
                        let diagramUrl = null;
                        const diagramsField = records[0].get('Diagrams');
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Raw Diagrams field:', diagramsField);
                        }
                        if (diagramsField && Array.isArray(diagramsField) && diagramsField.length > 0) {
                            // Get the URL from the first attachment
                            diagramUrl = diagramsField[0].url;
                            if (process.env.NODE_ENV !== 'production') {
                                console.log('Extracted diagram URL:', diagramUrl);
                            }
                        }
                        
                        const response = {
                            id: records[0].get('Record ID'),
                            photo: records[0].get('Photo'),
                            png: records[0].get('PNG'),
                            imageUrl: imageUrl, // This will be PNG if available, otherwise Photo
                            katex: katexContent,
                            Diagrams: diagramUrl
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

            case 'getPandaSkills':
                if (process.env.NODE_ENV !== 'production') {
                    console.log('Fetching Panda Skills from ACT database');
                }
                
                // Use environment variable for Panda Skills table ID
                const pandaSkillsTableId = process.env.PANDA_SKILLS_TABLE_ID;
                if (!pandaSkillsTableId) {
                    console.error('[getPandaSkills Error]: PANDA_SKILLS_TABLE_ID environment variable is not set');
                    console.error('[getPandaSkills Error]: Please set PANDA_SKILLS_TABLE_ID to tblN3Jr1BtB7IsoVv in Netlify environment variables');
                    return formatResponse(500, { 
                        message: 'Panda Skills table ID not configured. Please set PANDA_SKILLS_TABLE_ID environment variable to tblN3Jr1BtB7IsoVv' 
                    });
                }

                const pandaSkills = await actBase.table(pandaSkillsTableId)
                    .select({
                        fields: ['Name', 'Record ID']
                    })
                    .all()
                    .then(records => records.map(record => ({
                        id: record.get('Record ID'),
                        name: record.get('Name')
                    })));

                return formatResponse(200, pandaSkills);

            case 'getWorksheetQuestions':
                if (!skillId && !pandaSkillId) return formatResponse(400, { error: 'Missing skillId or pandaSkillId' });
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Fetching worksheet questions for ${pandaSkillId ? 'panda skill: ' + pandaSkillId : 'skill: ' + skillId} from ${database} database`);
                }

                try {
                    if (database === 'DRK') {
                        // Special handling for DRK database
                        const questionsTableId = process.env.DRK_QUESTIONS_TABLE_ID;
                        if (!questionsTableId) {
                            console.error('[getWorksheetQuestions Error]: Questions table ID is not defined for DRK database');
                            return formatResponse(500, { message: 'Questions table ID not configured for DRK database.' });
                        }

                        if (process.env.NODE_ENV !== 'production') {
                            console.log('DRK Questions Table ID:', questionsTableId);
                            console.log('Skill ID:', skillId);
                        }

                        const records = await drkBase.table(questionsTableId)
                            .select({
                                filterByFormula: `FIND('${skillId}', ARRAYJOIN({Skill}))`,
                                fields: ['Name', 'Question Number', 'Photo', 'PNG', 'LatexMarkdown']
                            })
                            .all();

                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Found records:', records.length);
                            if (records.length > 0) {
                                console.log('First record fields:', records[0].fields);
                            }
                        }

                        const questions = records.map(record => {
                            // Handle image fields - PNG takes priority over Photo
                            let imageUrl = null;
                            const pngField = record.get('PNG');
                            const photoField = record.get('Photo');
                            
                            // Check PNG field first
                            if (pngField && Array.isArray(pngField) && pngField.length > 0) {
                                imageUrl = pngField;
                                if (process.env.NODE_ENV !== 'production') {
                                    console.log('Using PNG field for DRK question:', record.id);
                                }
                            }
                            // Fall back to Photo field if PNG is empty
                            else if (photoField && Array.isArray(photoField) && photoField.length > 0) {
                                imageUrl = photoField;
                                if (process.env.NODE_ENV !== 'production') {
                                    console.log('Falling back to Photo field for DRK question:', record.id);
                                }
                            }
                            
                            return {
                                id: record.id,
                                name: record.get('Name'),
                                questionNumber: record.get('Question Number'),
                                photo: imageUrl, // This will be PNG if available, otherwise Photo
                                latex: record.get('LatexMarkdown')
                            };
                        });

                        // Get the skill name from DRK Skills table
                        const skillsTableId = process.env.DRK_PANDA_SKILLS_TABLE_ID;
                        const skillRecord = await drkBase.table(skillsTableId)
                            .select({
                                filterByFormula: `{Record ID} = '${skillId}'`,
                                fields: ['Name']
                            })
                            .firstPage();

                        const skillName = skillRecord[0]?.get('Name') || '';
                        return formatResponse(200, { questions, skillName });
                    }

                    // Original handling for ACT and SAT databases
                    let skillRecord, skillName, filterFormula;
                    
                    if (pandaSkillId && database === 'ACT') {
                        // Handle Panda Skills for ACT database
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('Using Panda Skills approach for ACT database');
                        }
                        
                        const pandaSkillsTableId = process.env.PANDA_SKILLS_TABLE_ID;
                        if (!pandaSkillsTableId) {
                            console.error('[getWorksheetQuestions Error]: Panda Skills table ID is not defined');
                            return formatResponse(500, { message: 'Panda Skills table ID not configured.' });
                        }

                        skillRecord = await base.table(pandaSkillsTableId)
                            .find(pandaSkillId)
                            .catch(error => {
                                console.error("Error fetching panda skill record:", error);
                                throw new Error("Failed to fetch panda skill record.");
                            });

                        if (!skillRecord) {
                            console.error('[getWorksheetQuestions Error]: Panda Skill not found for ID:', pandaSkillId);
                            return formatResponse(404, { message: "Panda Skill not found." });
                        }

                        skillName = skillRecord.fields.Name || 'Unknown Panda Skill';
                        
                        // For Panda Skills, we need to search by the Panda Skill field in questions
                        const questionsTableId = process.env.QUESTIONS_TABLE_ID;
                        if (!questionsTableId) {
                            console.error('[getWorksheetQuestions Error]: Questions table ID is not defined for ACT database');
                            return formatResponse(500, { message: 'Questions table ID not configured for ACT database.' });
                        }

                        // Use Panda Skill field to filter questions - try both ID and name
                        filterFormula = `OR(FIND('${pandaSkillId}', ARRAYJOIN({Panda Skill})), FIND('${skillName}', ARRAYJOIN({Panda Skill})))`;
                        
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('[getWorksheetQuestions Debug] Panda Skill filter formula:', filterFormula);
                            console.log('[getWorksheetQuestions Debug] Searching for Panda Skill ID:', pandaSkillId);
                            console.log('[getWorksheetQuestions Debug] Panda Skill Name:', skillName);
                        }

                    } else {
                        // Handle regular Skills for ACT and SAT databases
                        const skillsTableId = database === 'SAT' ? process.env.SAT_SKILLS_TABLE_ID : process.env.SKILLS_TABLE_ID;
                        if (!skillsTableId) {
                            console.error('[getWorksheetQuestions Error]: Skills table ID is not defined for database:', database);
                            return formatResponse(500, { message: 'Skills table ID not configured for this database.' });
                        }

                        skillRecord = await base.table(skillsTableId)
                            .find(skillId)
                            .catch(error => {
                                console.error("Error fetching skill record:", error);
                                throw new Error("Failed to fetch skill record.");
                            });

                        if (!skillRecord) {
                            console.error('[getWorksheetQuestions Error]: Skill not found for ID:', skillId);
                            return formatResponse(404, { message: "Skill not found." });
                        }

                        skillName = skillRecord.fields.Name || 'Unknown Skill';
                        
                        const linkedQuestions = skillRecord.fields.LinkedQuestions || [];
                        
                        if (linkedQuestions.length === 0) {
                            console.log('[getWorksheetQuestions Debug] No linked questions found');
                            return formatResponse(200, { questions: [], skillName });
                        }

                        // Different query logic for SAT vs ACT
                        if (database === 'SAT') {
                            filterFormula = `OR(${linkedQuestions.map(id => `RECORD_ID() = '${id}'`).join(', ')})`;
                        } else {
                            filterFormula = `OR(${linkedQuestions.map(id => `RECORD_ID() = '${id}'`).join(', ')})`;
                        }
                    }

                    const questionsTableId = database === 'SAT' ? process.env.SAT_QUESTIONS_TABLE_ID : process.env.QUESTIONS_TABLE_ID;
                    if (!questionsTableId) {
                        console.error('[getWorksheetQuestions Error]: Questions table ID is not defined for database:', database);
                        return formatResponse(500, { message: 'Questions table ID not configured for this database.' });
                    }

                    console.log('[getWorksheetQuestions Debug] Querying questions table:', {
                        questionsTableId,
                        filterFormula,
                        database
                    });

                    const records = await base.table(questionsTableId)
                        .select({
                            filterByFormula: filterFormula,
                            fields: database === 'SAT' 
                                ? ['Photo', 'PNG', 'LatexMarkdown', 'Diagram', 'Test Name', 'Question Number', 'Name', 'Answer']
                                : ['Photo', 'PNG', 'LatexMarkdown', 'Diagram', 'Test Number', 'Question Number', 'Name', 'Answer', 'Panda Skill']
                        })
                        .all()
                        .catch(error => {
                            console.error('[getWorksheetQuestions Error] Failed to fetch questions:', error);
                            throw error;
                        });

                    console.log('[getWorksheetQuestions Debug] Found records:', {
                        count: records.length,
                        firstRecordFields: records.length > 0 ? Object.keys(records[0].fields) : []
                    });
                    
                    // Debug Panda Skill field values if using Panda Skills
                    if (pandaSkillId && records.length > 0) {
                        console.log('[getWorksheetQuestions Debug] Sample Panda Skill field values:');
                        records.slice(0, 3).forEach((record, index) => {
                            console.log(`Record ${index + 1} Panda Skill:`, record.get('Panda Skill'));
                        });
                    }

                    const fetchedQuestions = records.map(record => {
                        // Handle image fields - PNG takes priority over Photo
                        let imageUrl = null;
                        const pngField = record.get('PNG');
                        const photoField = record.get('Photo');
                        
                        // Check PNG field first
                        if (pngField && Array.isArray(pngField) && pngField.length > 0) {
                            imageUrl = pngField;
                            if (process.env.NODE_ENV !== 'production') {
                                console.log(`Using PNG field for ${database} question:`, record.id);
                            }
                        }
                        // Fall back to Photo field if PNG is empty
                        else if (photoField && Array.isArray(photoField) && photoField.length > 0) {
                            imageUrl = photoField;
                            if (process.env.NODE_ENV !== 'production') {
                                console.log(`Falling back to Photo field for ${database} question:`, record.id);
                            }
                        }
                        
                        return {
                            id: record.id,
                            photo: imageUrl, // This will be PNG if available, otherwise Photo
                            latex: record.get('LatexMarkdown'),
                            diagram: record.get('Diagram'),
                            testNumber: database === 'SAT' ? record.get('Test Name') : record.get('Test Number'),
                            questionNumber: record.get('Question Number'),
                            name: record.get('Name'),
                            answer: record.get('Answer'),
                            isClone: false
                        };
                    });

                    const includeClones = event.queryStringParameters.includeClones === 'true' && database !== 'SAT';
                    let allQuestions = fetchedQuestions;

                    if (includeClones) {
                        try {
                            const originalQuestionIds = fetchedQuestions.map(q => q.id);
                            const copycatsTableId = process.env.COPYCATS_TABLE_ID;
                            if (!copycatsTableId) {
                                console.error('[getWorksheetQuestions Error]: CopyCats table ID is not defined.');
                            } else {
                                const cloneRecords = await base.table(copycatsTableId)
                                    .select({
                                        filterByFormula: `OR(${originalQuestionIds.map(id => `FIND('${id}', ARRAYJOIN({Original Question})) > 0`).join(', ')})`,
                                        fields: [
                                            'Corrected Clone Question LM',
                                            'Original Question',
                                            'AI Model'
                                        ]
                                    })
                                    .all();

                                const cloneQuestions = cloneRecords
                                    .filter(clone => clone.get('Corrected Clone Question LM'))
                                    .map(clone => ({
                                        id: clone.id,
                                        katex: clone.get('Corrected Clone Question LM'),
                                        model: clone.get('AI Model') || 'AI Generated',
                                        originalQuestion: clone.get('Original Question'),
                                        isClone: true
                                    }));

                                if (process.env.NODE_ENV !== 'production') {
                                    console.log(`Found ${cloneQuestions.length} clone questions`);
                                }

                                allQuestions = [...fetchedQuestions, ...cloneQuestions];
                            }
                        } catch (cloneError) {
                            console.error('Error fetching clone questions:', cloneError);
                        }
                    }

                    allQuestions.sort((a, b) => {
                        const getQuestionNumber = (q) => {
                            if (!q) return -1;
                            if (!q.isClone) {
                                return parseInt(q.questionNumber, 10) || 0;
                            } else {
                                const parts = q.originalQuestion ? q.originalQuestion.split(' - #') : [];
                                return parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
                            }
                        };
                        return getQuestionNumber(a) - getQuestionNumber(b);
                    });

                    return formatResponse(200, {
                        questions: allQuestions,
                        skillName: skillName
                    });
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
