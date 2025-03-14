from airtable import Airtable
import re
from dotenv import load_dotenv
import os
import requests
import time

# Load environment variables
load_dotenv('/Users/scotthardin/PycharmProjects/CopyCat ACT/.env')

# Retrieve API keys and base ID
AIRTABLE_API_KEY = os.getenv('AIRTABLE_API_KEY')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
BASE_ID = os.getenv('BASE_ID')

# Check if keys are loaded
if not DEEPSEEK_API_KEY:
    raise ValueError("DEEPSEEK_API_KEY is not set. Check your .env file.")
if not AIRTABLE_API_KEY:
    raise ValueError("AIRTABLE_API_KEY is not set. Check your .env file.")
if not BASE_ID:
    raise ValueError("BASE_ID is not set. Check your .env file.")

# Define table IDs
QUESTIONS_TABLE = 'tbllwZpPeh9yHJ3fM'  # Questions table ID
COPYCAT_TABLE = 'tblpE46FDmB0LmeTU'  # CopyCats table ID

# Initialize Airtable client
airtable_questions = Airtable(BASE_ID, QUESTIONS_TABLE, api_key=AIRTABLE_API_KEY)
airtable_copycat = Airtable(BASE_ID, COPYCAT_TABLE, api_key=AIRTABLE_API_KEY)


# Custom function to call DeepSeek R1 API with retries
def call_deepseek_api(prompt, retries=5, delay=5):
    url = "https://api.deepseek.com/v1/chat/completions"  # Verify this endpoint
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "deepseek-reasoner",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1000,  # Increased to allow more content
        "stream": False
    }

    for attempt in range(retries):
        try:
            response = requests.post(url, json=data, headers=headers)
            response.raise_for_status()
            return response.json()['choices'][0]['message']['content']
        except requests.exceptions.RequestException as e:
            if attempt < retries - 1:
                print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                print(f"Error calling DeepSeek API after {retries} attempts: {e}")
                if e.response is not None:
                    print(f"Response content: {e.response.text}")
                return None


# Prompt for Test Number
test_number = input("Enter the Test Number: ")
formula = f"AND({{Test Number}} = '{test_number}', {{AI Check}} = '✅ Match')"
records = airtable_questions.get_all(formula=formula)

for record in records:
    original_id = record['id']
    latex_markdown = record['fields']['LatexMarkdown']

    # Updated prompt with example
    prompt = f"""
    Here is a question in LatexMarkdown format:

    {latex_markdown}

    Please provide the following in a structured response:
    1) **Analysis:** Explain, as a 17-year-old student, why a student might choose wrong answers.
    2) **New Question:** Create a similar question with different values/context in Markdown with LaTeX (inline $...$, display $$...$$), starting directly with the question (no numbers like '9.' or intros like 'Here is a question').
    3) **Answer:** Provide the correct answer as a single letter (A, B, C, D, or E).
    4) **Explanation:** Explain how to solve the new question as a 17-year-old average math student, using simple language.

    Example response:
    **Analysis:**
    Students might pick C if they forget to divide.
    **New Question:**
    What is $x$ if $2x + 3 = 7$?
    **Answer:**
    A
    **Explanation:**
    Subtract 3 from both sides to get $2x = 4$, then divide by 2, so $x = 2$.

    Your response:
    """

    try:
        # Call DeepSeek R1 API
        response_text = call_deepseek_api(prompt)
        if not response_text:
            continue
        print(f"Raw response for question {original_id}: {response_text}")
    except Exception as e:
        print(f"Error calling DeepSeek API for question {original_id}: {e}")
        continue

    try:
        # Extract sections with fallbacks
        analysis_match = re.search(
            r'\*\*Analysis:\*\*(.*?)(?=\*\*New Question:\*\*|\*\*Answer:\*\*|\*\*Explanation:\*\*|$)', response_text,
            re.DOTALL)
        new_question_match = re.search(r'\*\*New Question:\*\*(.*?)(?=\*\*Answer:\*\*|\*\*Explanation:\*\*|$)',
                                       response_text, re.DOTALL)
        answer_match = re.search(r'\*\*Answer:\*\*(.*?)(?=\*\*Explanation:\*\*|$)', response_text, re.DOTALL)
        explanation_match = re.search(r'\*\*Explanation:\*\*(.*)', response_text, re.DOTALL)

        # Assign with fallbacks
        analysis = analysis_match.group(1).strip() if analysis_match else "No analysis provided"
        new_question = new_question_match.group(1).strip() if new_question_match else "No new question provided"
        answer = answer_match.group(1).strip() if answer_match else ""
        explanation = explanation_match.group(1).strip() if explanation_match else "No explanation provided"

        if not answer and not new_question:
            raise ValueError(f"Response format is incorrect. Missing critical sections. Raw response: {response_text}")

        # Validate the answer if present
        if answer and (len(answer) != 1 or not answer.isalpha()):
            raise ValueError(f"Answer '{answer}' is not a single letter.")
    except Exception as e:
        print(f"Error parsing response for question {original_id}: {e}")
        continue

    try:
        # Insert into CopyCats table with the explanation
        airtable_copycat.insert({
            'Clone Question LM': new_question,
            'Answer': answer,
            'Original Question': [original_id],
            'AI Model': 'DeepSeek R1',
            'Explanation': explanation
        })
        print(f"Successfully added copycat question for original question {original_id}")
    except Exception as e:
        print(f"Error inserting record for question {original_id}: {e}")

print("Processing complete.")