import os
import requests
import json
import logging
import time
from dotenv import load_dotenv

load_dotenv()  # Ensure .env file is loaded

# Load API keys from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Airtable configuration
BASE_ID = "apph1PxO7uc4r7U6j"
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
TABLE_NAME = "Questions"

# Debugging: Print API Key Value Before Checking It
print("AIRTABLE_API_KEY:", os.getenv("AIRTABLE_API_KEY"))  # Debugging line

# Verify environment variables
if not AIRTABLE_API_KEY:
    logging.error("Missing required Airtable API key in .env file.")
    exit(1)

# Construct the base URL
BASE_URL = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_NAME}"

# Headers for Airtable API
HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_API_KEY}",
    "Content-Type": "application/json"
}

# Available AI models
models = {
    '1': {'name': 'ChatGPT 4o', 'provider': 'openai', 'model': 'gpt-4o'},
    '2': {'name': 'GPT-3.5 Turbo', 'provider': 'openai', 'model': 'gpt-3.5-turbo'},
    '3': {'name': 'Claude 3.5 Sonnet', 'provider': 'anthropic', 'model': 'claude-3-45-sonnet-20240620'},
    '4': {'name': 'Claude 3.5 Haiku', 'provider': 'anthropic', 'model': 'claude-3-5-haiku-20241022'}
}

# Prompt user for model selection
print("Select the AI model to use:")
for key, model in models.items():
    print(f"{key}: {model['name']}")

choice = input("Enter the number corresponding to your choice: ").strip()

if choice not in models:
    print("Invalid selection. Exiting.")
    exit(1)

selected_model = models[choice]
provider = selected_model['provider']
model_name = selected_model['model']

logging.info(f"Selected model: {selected_model['name']}")

def fetch_records():
    """Fetch up to 1000 records that need cleaning with pagination."""
    params = {
        "filterByFormula": "AND({Explanation 4o} != '', OR({Corrected Explanation} = '', {Corrected Explanation} = BLANK()))",
        "fields": ["Explanation 4o", "Test Number", "Question Number"],
        "maxRecords": 2000,
        "pageSize": 100  # Airtable only returns 100 records per page
    }

    records = []
    offset = None

    while True:
        if offset:
            params["offset"] = offset  # Add offset to request next page

        try:
            response = requests.get(BASE_URL, headers=HEADERS, params=params)
            response.raise_for_status()
            data = response.json()

            records.extend(data.get("records", []))  # Append new records

            offset = data.get("offset")  # Get new offset for next page
            if not offset:
                break  # No more pages, exit loop

        except requests.exceptions.HTTPError as e:
            logging.error(f"Failed to fetch records: {e} - Response: {response.text}")
            return records

    logging.info(f"Fetched {len(records)} records that need cleaning")
    return records

def clean_text_with_model(text):
    """Clean and format text using the selected AI model."""
    if not text or text.strip() == "":
        return text

    prompt = (
        "Format the following mathematical explanation using proper Markdown and MathJax syntax:\n\n"
        f"{text}"
    )

    if provider == 'openai':
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)  # Use new OpenAI client

        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logging.error(f"Error with OpenAI API: {e}")
            return text

    elif provider == 'anthropic':
        from anthropic import Anthropic
        client = Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            response = client.messages.create(
                model=model_name,
                max_tokens=1500,
                temperature=0.0,
                system="You are a MathJax formatting expert. Follow the example format EXACTLY.",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text.strip()
        except Exception as e:
            logging.error(f"Error with Anthropic API: {e}")
            return text

def update_record(record_id, cleaned_explanation):
    """Update a record with cleaned explanation text."""
    data = {
        "fields": {
            "Corrected Explanation": cleaned_explanation
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
    try:
        test_response = requests.get(BASE_URL, headers=HEADERS)
        test_response.raise_for_status()
        records = fetch_records()

        print(f"\nProcessing {len(records)} records...")

        if len(records) == 0:
            print("No records to process.")
            return

        processed_records = []  # Store processed record IDs

        # Process records with a delay to respect rate limits
        for i, record in enumerate(records):
            record_id = record["id"]
            fields = record.get("fields", {})
            explanation = fields.get("Explanation 4o", "")

            print(f"Processing record {i + 1}/{len(records)} - ID: {record_id}")

            cleaned_explanation = clean_text_with_model(explanation)
            if update_record(record_id, cleaned_explanation):
                processed_records.append(record_id)  # Store successful updates

            time.sleep(0.3)  # Adjusted delay to respect rate limits

        if processed_records:
            print("\nSuccessfully processed the following records:")
            for record_id in processed_records:
                print(f"- {record_id}")
        else:
            print("\nNo records were successfully processed.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()