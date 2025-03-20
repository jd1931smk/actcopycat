from airtable import Airtable
import re
from dotenv import load_dotenv
import os
import time

# Load environment variables
load_dotenv()

# Retrieve API key and base ID
AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')
BASE_ID = os.getenv('BASE_ID')
QUESTIONS_TABLE = 'tbllwZpPeh9yHJ3fM'  # Questions table ID

# Initialize Airtable client
airtable = Airtable(BASE_ID, QUESTIONS_TABLE, api_key=AIRTABLE_API_KEY)

def clean_latex(text):
    if not text:
        return text
        
    # Replace $$ with \[ and \]
    text = re.sub(r'\$\$(.*?)\$\$', r'\\[\1\\]', text)
    
    # Replace $ with \( and \) but not \$
    text = re.sub(r'(?<!\\)\$(.*?)(?<!\\)\$', r'\\(\1\\)', text)
    
    # Fix spacing around delimiters
    text = re.sub(r'([^\s])(\\[\(\[])', r'\1 \2', text)  # Add space before
    text = re.sub(r'(\\[\)\]])([\w])', r'\1 \2', text)   # Add space after
    
    # Remove extra spaces inside delimiters
    text = re.sub(r'\\[\(\[]\s+', r'\\(', text)
    text = re.sub(r'\s+\\[\)\]]', r'\\)', text)
    
    # Fix common LaTeX issues
    text = text.replace('\\\\', '\\')  # Remove double backslashes
    text = re.sub(r'\\([^a-zA-Z\s\(\)\[\]])', r'\1', text)  # Remove unnecessary escapes
    
    return text

def main():
    print("Starting explanation cleanup...")
    
    # Get all records with explanations
    records = airtable.get_all(fields=['Explanation 4o'])
    print(f"Found {len(records)} records")
    
    updated_count = 0
    for record in records:
        explanation = record.get('fields', {}).get('Explanation 4o')
        if not explanation:
            continue
            
        cleaned_explanation = clean_latex(explanation)
        if cleaned_explanation != explanation:
            try:
                airtable.update(record['id'], {'Explanation 4o': cleaned_explanation})
                updated_count += 1
                print(f"Updated record {record['id']}")
                time.sleep(0.2)  # Rate limiting
            except Exception as e:
                print(f"Error updating record {record['id']}: {e}")
    
    print(f"\nCleanup completed. Updated {updated_count} records.")

if __name__ == "__main__":
    main() 