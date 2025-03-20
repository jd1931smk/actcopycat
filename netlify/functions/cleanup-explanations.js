const Airtable = require('airtable');

// Initialize Airtable with API Key
const base = new Airtable({ apiKey: process.env.API_KEY }).base(process.env.BASE_ID);

function cleanLatex(text) {
    if (!text) return text;

    // Replace $$ with \[ and \]
    text = text.replace(/\$\$(.*?)\$\$/g, '\\[$1\\]');

    // Replace $ with \( and \) but not \$
    text = text.replace(/(?<!\\)\$(.*?)(?<!\\)\$/g, '\\($1\\)');

    // Fix spacing around delimiters
    text = text.replace(/([^\s])(\\[\(\[])/g, '$1 $2');  // Add space before
    text = text.replace(/(\\[\)\]])([\w])/g, '$1 $2');   // Add space after

    // Remove extra spaces inside delimiters
    text = text.replace(/\\[\(\[]\s+/g, '\\(');
    text = text.replace(/\s+\\[\)\]]/g, '\\)');

    // Fix common LaTeX issues
    text = text.replace(/\\\\/g, '\\');  // Remove double backslashes
    text = text.replace(/\\([^a-zA-Z\s\(\)\[\]])/g, '$1');  // Remove unnecessary escapes

    return text;
}

exports.handler = async (event) => {
    console.log("Starting explanation cleanup...");

    try {
        // Fetch records with explanations
        const records = await base('Questions')
            .select({
                filterByFormula: "NOT({Explanation 4o} = '')",
                fields: ['Explanation 4o']
            })
            .all();

        console.log(`Found ${records.length} records with explanations`);

        let updatedCount = 0;
        let errorCount = 0;

        // Process each record
        for (const record of records) {
            const explanation = record.get('Explanation 4o');
            const cleanedExplanation = cleanLatex(explanation);

            // Skip if no changes needed
            if (cleanedExplanation === explanation) {
                console.log(`No changes needed for record ${record.id}`);
                continue;
            }

            try {
                // Update the record
                await base('Questions').update(record.id, {
                    'Explanation 4o': cleanedExplanation
                });
                updatedCount++;
                console.log(`Successfully updated record ${record.id}`);
            } catch (error) {
                errorCount++;
                console.error(`Error updating record ${record.id}:`, error);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Cleanup completed',
                totalRecords: records.length,
                updatedRecords: updatedCount,
                errorCount: errorCount
            })
        };

    } catch (error) {
        console.error('Error in cleanup process:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process explanations' })
        };
    }
}; 