from airtable import Airtable
import requests
import re
from dotenv import load_dotenv
import os
import time

# Load environment variables
load_dotenv('/Users/scotthardin/PycharmProjects/CopyCat ACT/.env')

# Retrieve API key and base ID
AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')
BASE_ID = os.getenv('BASE_ID')

if not AIRTABLE_API_KEY or not BASE_ID:
    raise ValueError("API key or Base ID not set. Check your .env file.")

QUESTIONS_TABLE = 'tbllwZpPeh9yHJ3fM'
COPYCAT_TABLE = 'tblpE46FDmB0LmeTU'

airtable_questions = Airtable(BASE_ID, QUESTIONS_TABLE, api_key=AIRTABLE_API_KEY)
airtable_copycat = Airtable(BASE_ID, COPYCAT_TABLE, api_key=AIRTABLE_API_KEY)

OLLAMA_API_URL = "http://localhost:11434/api/generate"

test_number = input("Enter the Test Number: ")
formula = f"AND({{Test Number}} = '{test_number}', {{AI Check}} = '✅ Match')"
records = airtable_questions.get_all(formula=formula)

for record in records:
    original_id = record['id']
    latex_markdown = record['fields']['LatexMarkdown']

    prompt = f"""
    Here is a question in LatexMarkdown format:

    {latex_markdown}

    Please perform the following tasks:

    1) Analyze the question as if you are a 17-year-old student. Think about why a student might choose each of the wrong answers.
    2) Create a similar question with different values and/or context. Provide the new question in Markdown format, using LaTeX for math expressions (inline math between $, standalone equations between $$).

    Structure your response as follows:

    **Analysis:**

    [Your analysis here]

    **New Question:**

    [New question here]

    **Answer:**

    [Single letter]

    Important: The **Answer:** section must contain only a single letter (A, B, C, D, or E) on its own line, with no additional text, explanations, or notes.
    """

    max_retries = 5
    response_text = None
    for attempt in range(max_retries):
        try:
            response = requests.post(
                OLLAMA_API_URL,
                json={"model": "gemma3", "prompt": prompt, "stream": False},
                timeout=30
            )
            response.raise_for_status()
            response_text = response.json().get("response", "")
            if not response_text:
                raise ValueError("Empty response from Ollama")
            break
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                print(f"404 Error: Check if Ollama is running and 'gemma3' is installed.")
                break
            wait_time = 2 ** attempt
            print(f"Error. Retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
        except Exception as e:
            print(f"Error for question {original_id}: {e}")
            break

    if response_text and response_text.strip() and "I don’t know" not in response_text:
        try:
            analysis_match = re.search(r'(?:\*\*Analysis:\*\*|Analysis:)(.*?)(?:\*\*New Question:\*\*|New Question:)', response_text, re.DOTALL)
            new_question_match = re.search(r'(?:\*\*New Question:\*\*|New Question:)(.*?)(?:\*\*Answer:\*\*|Answer:)', response_text, re.DOTALL)
            answer_match = re.search(r'(?:\*\*Answer:\*\*|Answer:)\s*([A-E])(?:\s|\n|$)', response_text, re.DOTALL)

            if not (new_question_match and answer_match):  # Analysis is optional
                print(f"Failed response for {original_id}:\n{response_text}\n---")
                raise ValueError("Response format is incorrect (missing New Question or Answer).")

            explanation = analysis_match.group(1).strip() if analysis_match else "No analysis provided"
            new_question = new_question_match.group(1).strip()
            answer = answer_match.group(1).strip()

            if answer not in ['A', 'B', 'C', 'D', 'E']:
                raise ValueError(f"Answer '{answer}' is not valid (A-E).")
        except Exception as e:
            print(f"Error parsing response for question {original_id}: {e}")
            continue

        try:
            airtable_copycat.insert({
                'Clone Question LM': new_question,
                'Answer': answer,
                'Original Question': [original_id],
                'AI Model': 'Gemma3',
                'Explanation': explanation
            })
            print(f"Successfully added copycat question for {original_id}")
        except Exception as e:
            print(f"Error inserting record for question {original_id}: {e}")
    else:
        print(f"Skipping {original_id}: Invalid or empty response")

    time.sleep(1)

print("Processing complete.")