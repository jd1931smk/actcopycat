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
                            .map(r => r.get('Question Number'))
                            .filter(Boolean)
                            .sort((a, b) => {
                                // Try to parse as numbers first
                                const numA = parseInt(a);
                                const numB = parseInt(b);
                                
                                // If both are valid numbers, compare numerically
                                if (!isNaN(numA) && !isNaN(numB)) {
                                    return numA - numB;
                                }
                                
                                // Otherwise, use string comparison
                                return String(a).localeCompare(String(b));
                            });
                    });

                return formatResponse(200, questionNumbers);

            case 'getQuestionDetails':
                if (!testNumber || !questionNumber) return formatResponse(400, 'Missing testNumber or questionNumber');
                console.log(`Fetching Question Details for Test: ${testNumber}, Question: ${questionNumber}`);
                const question = await base('Questions')
                    .select({
                        filterByFormula: `AND({Test Number} = '${testNumber}', {Question Number} = ${questionNumber})`,
                        fields: ['Photo', 'Record ID', 'LatexMarkdown clean', 'Diagrams']
                    })
                    .firstPage()
                    .then(records => {
                        if (!records[0]) return null;
                        
                        let latex = records[0].get('LatexMarkdown clean');
                        // Add line breaks between multiple choice answers
                        if (latex) {
                            // First, ensure there's a space after each answer letter
                            latex = latex.replace(/([A-E]\.(?!\s))/g, '$1 ');
                            // Add double line breaks before each answer
                            latex = latex.replace(/([A-E]\.)/g, '\n\n$1');
                            // Add line break after the question text (before first answer)
                            latex = latex.replace(/(\?|\.)([A-E]\.)/g, '$1\n\n$2');
                            // Clean up any excessive line breaks
                            latex = latex.replace(/\n{3,}/g, '\n\n');
                            latex = latex.trim();
                        }
                        
                        return {
                            id: records[0].get('Record ID'),
                            photo: records[0].get('Photo'),
                            latex: latex,
                            diagrams: records[0].get('Diagrams')
                        };
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
                    // First check if the question exists
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

                    // More flexible matching - try both exact and flexible formats
                    const filterFormula = `OR(
                        {Original Question} = '${testNumber} - ${questionNumber}',
                        {Original Question} = '${testNumber}-${questionNumber}',
                        {Original Question} = '${testNumber} ${questionNumber}'
                    )`;

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

                    const clones = records
                        .filter(r => r.get('Corrected Clone Question LM')) // Only include records with actual clone content
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
                    console.log('getSkills: Starting to fetch skills...');
                    console.log('getSkills: Environment check:', {
                        baseId: process.env.BASE_ID,
                        hasApiKey: !!process.env.AIRTABLE_API_KEY
                    });
                    
                    // Fetch from Questions table and get unique skills
                    console.log('getSkills: Fetching from Questions table...');
                    const records = await base('tbllwZpPeh9yHJ3fM')
                        .select({
                            fields: ['Skill'],
                            maxRecords: 100  // Limit for performance
                        })
                        .firstPage();

                    console.log(`getSkills: Fetched ${records.length} records`);
                    
                    // Extract all unique skills from the Skill field
                    const skillSet = new Set();
                    records.forEach(record => {
                        const skills = record.get('Skill');
                        if (Array.isArray(skills)) {
                            skills.forEach(skill => {
                                if (skill) skillSet.add(skill);
                            });
                        }
                    });

                    // Convert to required format and sort
                    const skills = Array.from(skillSet)
                        .map(name => ({
                            id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                            name: name
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name));

                    console.log('getSkills: Processed skills:', {
                        totalSkills: skills.length,
                        firstFew: skills.slice(0, 3)
                    });
                    
                    if (skills.length === 0) {
                        console.warn('getSkills: No skills found in records');
                        return formatResponse(404, { 
                            error: 'No skills found',
                            details: 'No skills found in the Questions table'
                        });
                    }
                    
                    return formatResponse(200, skills);
                } catch (error) {
                    console.error('getSkills: Fatal error:', {
                        message: error.message,
                        type: error.type,
                        code: error.code,
                        stack: error.stack
                    });
                    return formatResponse(500, { 
                        error: 'Failed to fetch skills',
                        details: error.message,
                        type: error.type || 'Unknown'
                    });
                }

            case 'getWorksheetQuestions':
                const { skillId, includeClones } = event.queryStringParameters;
                console.log('Received parameters:', { skillId, includeClones });

                if (!skillId) {
                    console.log('Missing required parameter: skillId');
                    return formatResponse(400, { error: 'Skill ID is required' });
                }

                try {
                    console.log(`Fetching questions for skill ${skillId}`);
                    
                    // Convert skillId back to skill name
                    const skillName = skillId.split('-').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ');
                    
                    // Get questions that have this skill, limit to first 5 for performance
                    const questionRecords = await base('tbllwZpPeh9yHJ3fM')
                        .select({
                            maxRecords: 5,
                            filterByFormula: `FIND("${skillName}", ARRAYJOIN({Skill})) > 0`,
                            fields: [
                                'Photo', 
                                'LatexMarkdown',
                                'Test Number', 
                                'Question Number',
                                'Answer'
                            ]
                        })
                        .firstPage();

                    console.log(`Found ${questionRecords.length} questions with skill: ${skillName}`);

                    let allQuestions = questionRecords.map(record => ({
                        id: record.id,
                        photo: record.get('Photo'),
                        latexMarkdown: record.get('LatexMarkdown'),
                        testNumber: record.get('Test Number'),
                        questionNumber: record.get('Question Number'),
                        answer: record.get('Answer'),
                        isClone: false
                    }));

                    // Return immediately if we don't need clones or have no original questions
                    if (includeClones !== 'true' || questionRecords.length === 0) {
                        return formatResponse(200, {
                            skillName,
                            questions: allQuestions,
                            hasMoreQuestions: true // Indicate that clones can be loaded separately
                        });
                    }

                    return formatResponse(200, {
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
                                'Original Question'
                            ]
                        })
                        .firstPage();

                    console.log(`Found ${cloneRecords.length} clone records`);

                    const cloneQuestions = cloneRecords
                        .filter(clone => clone.get('Corrected Clone Question LM'))
                        .map(clone => {
                            const originalRef = clone.get('Original Question').split(' - ');
                            return {
                                id: clone.id,
                                latexMarkdown: clone.get('Corrected Clone Question LM'),
                                testNumber: `Clone of ${originalRef[0]}`,
                                questionNumber: originalRef[1],
                                isClone: true,
                                originalQuestion: clone.get('Original Question')
                            };
                        });

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
