from airtable import Airtable
import os
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

# Get environment variables
AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')
BASE_ID = os.getenv('BASE_ID')

# Verify environment variables
if not AIRTABLE_API_KEY:
    raise ValueError("AIRTABLE_API_KEY is not set")
if not BASE_ID:
    raise ValueError("BASE_ID is not set")

# Table IDs
QUESTIONS_TABLE = 'tbllwZpPeh9yHJ3fM'  # Original Questions table
COPYCATS_TABLE = 'tblpE46FDmB0LmeTU'   # CopyCats table
SKILLS_TABLE = 'tbl6l9Pu2uHM2XlvV'     # Skills table

# Initialize Airtable clients
questions_table = Airtable(BASE_ID, QUESTIONS_TABLE, api_key=AIRTABLE_API_KEY)
copycats_table = Airtable(BASE_ID, COPYCATS_TABLE, api_key=AIRTABLE_API_KEY)

def get_original_question_id(test_num, question_num):
    """Get the record ID of the original question based on test and question numbers."""
    formula = f"AND({{Test Number}} = '{test_num}', {{Question Number}} = '{question_num}')"
    records = questions_table.get_all(formula=formula)
    return records[0]['id'] if records else None

def copy_skills():
    # Get all CopyCat records
    copycat_records = copycats_table.get_all()
    print(f"Found {len(copycat_records)} CopyCat records")
    
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    for record in copycat_records:
        try:
            # Get the Original Question reference
            original_question_id = record['fields'].get('Original Question')
            if not original_question_id:
                print(f"Skipping record {record['id']}: No Original Question reference")
                skipped_count += 1
                continue
                
            # Get the original question record
            original_question = questions_table.get(original_question_id[0])
            
            # Get the skills from the original question
            skills = original_question['fields'].get('Skill', [])
            
            # Update the CopyCat record with the skills
            if skills:
                copycats_table.update(record['id'], {
                    'Skill': skills
                })
                print(f"Updated record {record['id']} with skills: {skills}")
                updated_count += 1
            else:
                print(f"Skipping record {record['id']}: No skills found in original question {original_question_id[0]}")
                skipped_count += 1
            
            # Add a small delay to avoid rate limits
            time.sleep(0.2)
            
        except Exception as e:
            print(f"Error processing record {record['id']}: {str(e)}")
            error_count += 1
            continue
    
    print("\nSummary:")
    print(f"Total records processed: {len(copycat_records)}")
    print(f"Successfully updated: {updated_count}")
    print(f"Skipped: {skipped_count}")
    print(f"Errors: {error_count}")

def main():
    print("Starting skill copy process...")
    copy_skills()
    print("\nSkill copy process completed!")

if __name__ == "__main__":
    main() 