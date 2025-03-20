import os
import requests
from dotenv import load_dotenv
from openai import OpenAI
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    logging.error("OPENAI_API_KEY not found in .env file.")
    exit(1)
client = OpenAI(api_key=openai_api_key)

# Airtable configuration from .env
BASE_ID = os.getenv("BASE_ID")
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_TABLE_ID = os.getenv("AIRTABLE_TABLE_ID")  # CopyCats table ID

# Verify environment variables
if not all([BASE_ID, AIRTABLE_API_KEY, AIRTABLE_TABLE_ID]):
    logging.error("Missing required Airtable variables in .env file.")
    exit(1)

# Construct the base URL using the base ID and table ID
BASE_URL = f"https://api.airtable.com/v0/{BASE_ID}/{AIRTABLE_TABLE_ID}"

# Headers for Airtable API
HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_API_KEY}",
    "Content-Type": "application/json"
}

def fetch_records_by_model(model_name="GPT-4o"):
    """Fetch records from CopyCats table where AI Model is the specified model"""
    params = {
        "filterByFormula": f"AND({{AI Model}} = '{model_name}', NOT({{Corrected Clone Question LM}} != ''))",
        "fields": ["Clone Question LM", "Original Question", "AI Model"]
    }
    try:
        response = requests.get(BASE_URL, headers=HEADERS, params=params)
        response.raise_for_status()
        records = response.json().get("records", [])
        logging.info(f"Fetched {len(records)} records for model {model_name}")
        return records
    except requests.exceptions.HTTPError as e:
        logging.error(f"Failed to fetch records: {e} - Response: {response.text}")
        return []

def clean_text_with_gpt(text):
    """Clean and format text using GPT-4o"""
    if not text or text.strip() == "":
        return text

    prompt = (
        "You are an expert in Markdown and LaTeX formatting for MathJax. "
        "Clean up the following text to ensure it uses proper Markdown and LaTeX syntax "
        "for MathJax display. Requirements:\n"
        "1. Enclose inline math in $...$ and block math in $$...$$\n"
        "2. Ensure proper spacing around math delimiters\n"
        "3. Fix any broken LaTeX commands or syntax\n"
        "4. Preserve non-mathematical text formatting\n"
        "5. Remove any unnecessary line breaks or spaces\n\n"
        f"Text to clean:\n{text}"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a LaTeX and Markdown formatting expert."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.2
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Error cleaning text with GPT: {e}")
        return text

def update_record(record_id, cleaned_question):
    """Update a record with cleaned question text"""
    data = {
        "fields": {
            "Corrected Clone Question LM": cleaned_question
        }
    }
    try:
        response = requests.patch(f"{BASE_URL}/{record_id}", headers=HEADERS, data=json.dumps(data))
        response.raise_for_status()
        logging.info(f"Updated record {record_id} successfully")
        return True
    except requests.exceptions.HTTPError as e:
        logging.error(f"Failed to update record {record_id}: {e} - Response: {response.text}")
        return False

def main():
    logging.info("Starting cleanup of GPT-4o generated questions...")

    # Test API connectivity
    try:
        test_response = requests.get(BASE_URL, headers=HEADERS)
        test_response.raise_for_status()
        logging.info("Successfully connected to Airtable API")
    except requests.exceptions.HTTPError as e:
        logging.error(f"API connectivity test failed: {e}")
        return

    # Fetch and process records
    records = fetch_records_by_model("GPT-4o")
    if not records:
        logging.info("No records to process or fetch failed")
        return

    success_count = 0
    total_records = len(records)

    for i, record in enumerate(records, 1):
        record_id = record["id"]
        fields = record.get("fields", {})
        original_question = fields.get("Original Question", [""])[0]  # Get first item if it's a list
        clone_question = fields.get("Clone Question LM", "")

        logging.info(f"Processing record {i}/{total_records} (ID: {record_id})")
        logging.info(f"Original Question reference: {original_question}")

        cleaned_question = clean_text_with_gpt(clone_question)
        if update_record(record_id, cleaned_question):
            success_count += 1

    logging.info(f"Cleanup completed. Successfully processed {success_count}/{total_records} records")

if __name__ == "__main__":
    main() 