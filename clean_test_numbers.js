require('dotenv').config();
const Airtable = require('airtable');

const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base('apph1PxO7uc4r7U6j');

async function cleanTestNumbers() {
    try {
        console.log('Starting database cleanup...');
        
        // Get all records
        const records = await base('Questions').select({
            fields: ['Test Number']
        }).all();
        
        console.log(`Found ${records.length} records to process`);
        
        // Process records in batches of 10 (Airtable's limit)
        for (let i = 0; i < records.length; i += 10) {
            const batch = records.slice(i, i + 10);
            const updates = batch.map(record => {
                const testNumber = record.get('Test Number');
                if (!testNumber) return null;
                
                // Clean the test number by removing newlines and extra whitespace
                const cleanedTestNumber = testNumber.trim().replace(/[\n\r]+/g, '');
                
                // Only update if there's a change
                if (cleanedTestNumber !== testNumber) {
                    console.log(`Will update "${testNumber}" to "${cleanedTestNumber}"`);
                    return {
                        id: record.id,
                        fields: {
                            'Test Number': cleanedTestNumber
                        }
                    };
                }
                return null;
            }).filter(Boolean);
            
            if (updates.length > 0) {
                console.log(`Updating batch of ${updates.length} records...`);
                await base('Questions').update(updates);
                console.log(`Successfully updated ${updates.length} records`);
            }
        }
        
        console.log('Database cleanup completed successfully!');
        
    } catch (error) {
        console.error('Error during cleanup:', error);
        if (error.message) {
            console.error('Error message:', error.message);
        }
        if (error.statusCode) {
            console.error('Status code:', error.statusCode);
        }
    }
}

cleanTestNumbers(); 