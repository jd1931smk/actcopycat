import os
import requests
from dotenv import load_dotenv
import re
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables
load_dotenv()

# Airtable configuration
BASE_ID = os.getenv("BASE_ID")
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
QUESTIONS_TABLE = "tbllwZpPeh9yHJ3fM"  # Questions table ID

# Verify environment variables
if not all([BASE_ID, AIRTABLE_API_KEY]):
    logging.error("Missing required Airtable variables in .env file.")
    exit(1)

# Headers for Airtable API
HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_API_KEY}",
    "Content-Type": "application/json"
}

def clean_latex(text):
    if not text:
        return text
        
    # Replace $$ with \[ and \]
    text = re.sub(r'\$\$(.*?)\$\$', r'\\[\1\\]', text)
    
    # Replace $ with \( and \)
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
    
    # Ensure all delimiters are properly paired
    open_inline = text.count('\\(')
    close_inline = text.count('\\)')
    open_display = text.count('\\[')
    close_display = text.count('\\]')
    
    if open_inline != close_inline or open_display != close_display:
        logging.warning(f"Mismatched delimiters: {open_inline} \\( vs {close_inline} \\), {open_display} \\[ vs {close_display} \\]")
    
    return text

def fetch_records():
    """Fetch records from Questions table that have explanations"""
    url = f"https://api.airtable.com/v0/{BASE_ID}/{QUESTIONS_TABLE}"
    params = {
        "filterByFormula": "NOT({Explanation 4o} = '')",
        "fields": ["Explanation 4o"]
    }
    
    try:
        response = requests.get(url, headers=HEADERS, params=params)
        response.raise_for_status()
        records = response.json().get("records", [])
        logging.info(f"Fetched {len(records)} records with explanations")
        return records
    except requests.exceptions.HTTPError as e:
        logging.error(f"Failed to fetch records: {e}")
        return []

def update_record(record_id, cleaned_explanation):
    """Update a record with cleaned explanation"""
    url = f"https://api.airtable.com/v0/{BASE_ID}/{QUESTIONS_TABLE}/{record_id}"
    data = {
        "fields": {
            "Explanation 4o": cleaned_explanation
        }
    }
    
    try:
        response = requests.patch(url, headers=HEADERS, json=data)
        response.raise_for_status()
        return True
    except requests.exceptions.HTTPError as e:
        logging.error(f"Failed to update record {record_id}: {e}")
        return False

def main():
    logging.info("Starting explanation cleanup script...")
    
    # Fetch records
    records = fetch_records()
    if not records:
        logging.info("No records to process.")
        return
    
    # Process each record
    success_count = 0
    for record in records:
        record_id = record["id"]
        explanation = record.get("fields", {}).get("Explanation 4o", "")
        
        # Clean the explanation
        cleaned_explanation = clean_latex(explanation)
        
        # Skip if no changes were made
        if cleaned_explanation == explanation:
            logging.info(f"No changes needed for record {record_id}")
            continue
        
        # Update the record
        if update_record(record_id, cleaned_explanation):
            success_count += 1
            logging.info(f"Successfully updated record {record_id}")
        
    logging.info(f"Cleanup completed. Updated {success_count} records out of {len(records)}")

if __name__ == "__main__":
    main() 