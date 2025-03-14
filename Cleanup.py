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
BASE_ID = os.getenv("BASE_ID")  # Changed to match your .env file: 'apph1PxO7uc4r7U6j'
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")  # Your Airtable API key
AIRTABLE_TABLE_ID = os.getenv("AIRTABLE_TABLE_ID")  # Set to 'tblpE46FDmB0LmeTU' in .env

# Verify environment variables
if not all([BASE_ID, AIRTABLE_API_KEY, AIRTABLE_TABLE_ID]):
    logging.error("Missing required Airtable variables (BASE_ID, AIRTABLE_API_KEY, or AIRTABLE_TABLE_ID) in .env file.")
    exit(1)

# Construct the base URL using the base ID and table ID
BASE_URL = f"https://api.airtable.com/v0/{BASE_ID}/{AIRTABLE_TABLE_ID}"
# This becomes: https://api.airtable.com/v0/apph1PxO7uc4r7U6j/tblpE46FDmB0LmeTU

# Headers for Airtable API
HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_API_KEY}",
    "Content-Type": "application/json"
}


# Function to fetch records from CopyCats table where CleanedUp is not "Y"
def fetch_uncleaned_records():
    params = {
        "filterByFormula": "NOT({CleanedUp} = 'Y')",
        "fields": ["Clone Question LM", "Explanation", "CleanedUp"]
    }
    try:
        response = requests.get(BASE_URL, headers=HEADERS, params=params)
        response.raise_for_status()
        records = response.json().get("records", [])
        logging.info(f"Fetched {len(records)} records from Airtable.")
        return records
    except requests.exceptions.HTTPError as e:
        logging.error(f"Failed to fetch records: {e} - Response: {response.text}")
        return []


# Function to clean text using ChatGPT 4o API
def clean_text_with_gpt(text):
    if not text or text.strip() == "":
        return text

    prompt = (
        "You are an expert in Markdown and LaTeX formatting for MathJax. "
        "Clean up the following text to ensure it uses proper Markdown and LaTeX syntax "
        "so it displays correctly in MathJax. Ensure mathematical expressions are enclosed in `$...$` for inline math "
        "or `$$...$$` for block math, and preserve any non-mathematical text in Markdown format. "
        "Return only the cleaned-up text without additional commentary.\n\n"
        f"{text}"
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a formatting assistant."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.2
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Error cleaning text with GPT: {e}")
        return text


# Function to update a record in the database
def update_record(record_id, cleaned_clone_question, cleaned_explanation):
    data = {
        "fields": {
            "Clone Question LM": cleaned_clone_question,
            "Explanation": cleaned_explanation,
            "CleanedUp": "Y"
        }
    }
    try:
        response = requests.patch(f"{BASE_URL}/{record_id}", headers=HEADERS, data=json.dumps(data))
        response.raise_for_status()
        logging.info(f"Updated record {record_id} successfully.")
        return response.json()
    except requests.exceptions.HTTPError as e:
        logging.error(f"Failed to update record {record_id}: {e} - Response: {response.text}")
        return None


# Main script logic
def main():
    logging.info("Starting cleanup script...")

    # Test API connectivity
    try:
        test_response = requests.get(BASE_URL, headers=HEADERS)
        test_response.raise_for_status()
        logging.info("Successfully connected to Airtable API.")
    except requests.exceptions.HTTPError as e:
        logging.error(f"API connectivity test failed: {e} - Response: {test_response.text}")
        return

    # Fetch and process records
    records = fetch_uncleaned_records()
    if not records:
        logging.info("No records to process or fetch failed.")
        return

    for record in records:
        record_id = record["id"]
        fields = record.get("fields", {})
        clone_question = fields.get("Clone Question LM", "")
        explanation = fields.get("Explanation", "")
        cleaned_up = fields.get("CleanedUp", "")

        if cleaned_up == "Y":
            logging.info(f"Skipping already cleaned record {record_id}.")
            continue

        logging.info(f"Processing record {record_id}...")

        cleaned_clone_question = clean_text_with_gpt(clone_question)
        cleaned_explanation = clean_text_with_gpt(explanation)

        update_record(record_id, cleaned_clone_question, cleaned_explanation)

    logging.info("Cleanup script completed.")


if __name__ == "__main__":
    main()