import os
import time
import logging
import anthropic
from dotenv import load_dotenv
from pyairtable import Table

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("cleanup_explanations.log"),
        logging.StreamHandler()
    ]
)

# Load environment variables
load_dotenv()

# Airtable configuration
API_KEY = os.getenv("AIRTABLE_API_KEY")
BASE_ID = os.getenv("BASE_ID")
QUESTIONS_TABLE = "tbllwZpPeh9yHJ3fM"  # Questions table ID

# Anthropic API configuration
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Initialize clients
airtable = Table(API_KEY, BASE_ID, QUESTIONS_TABLE)
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

def clean_with_claude(text):
    """Clean LaTeX formatting using Claude API"""
    if not text or text.strip() == "":
        return text
    
    prompt = """
You are an expert in LaTeX formatting for MathJax. Your task is to fix the LaTeX syntax in the following math explanation text.

Guidelines:
1. Make sure all math expressions use proper LaTeX syntax with $ for inline math and $$ for display math
2. Ensure special symbols like \\times, \\sqrt, \\frac, etc. are properly formatted
3. Fix any issues with exponents (^) and subscripts (_)
4. Preserve the original meaning and content
5. Return ONLY the cleaned text without any explanation
6. Do not add or remove content
7. Do not change the structure or organization of the explanation

Here is the text to clean:

{text}

Cleaned text:
""".format(text=text)
    
    try:
        response = claude.messages.create(
            model="claude-3-haiku-20240307",  # Changed to Haiku model which is less likely to be overloaded
            max_tokens=4000,
            temperature=0.1,
            system="You are an expert in LaTeX formatting for MathJax who fixes math syntax issues in explanations.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return response.content[0].text.strip()
    except Exception as e:
        logging.error(f"Error calling Claude API: {e}")
        return text

def test_cleaning():
    """Test the cleaning process with a sample explanation."""
    sample_text = """
    43. If x and y are positive integers such that the greatest common factor of x^{2} y^{2} and x y^{3} is 45 , then which of the following could y equal?

    A. 45

    B. 15

    C. 9

    D. 5

    E. 3
    
    To solve this problem, we need to find positive integers (x) and (y) such that the greatest common factor (GCF) of (x^2 y^2) and (x y^3) is 45. We then need to determine which of the provided answer choices could be equal to (y).

### Step 1: Express the GCF in Terms of Prime Factors

The given GCF is 45. We express 45 in terms of its prime factors:

(45 = 3^2 \\times 5^1)

### Step 2: Set Up Expressions for (x^2 y^2) and (x y^3)

Assume:

- (x = 3^a \\times 5^b \\times \\ldots)
- (y = 3^c \\times 5^d \\times \\ldots)

Then:

- (x^2 y^2 = 3^{2a + 2c} \\times 5^{2b + 2d} \\times \\ldots)
- (x y^3 = 3^{a + 3c} \\times 5^{b + 3d} \\times \\ldots)
    """
    
    logging.info("Testing cleaning with sample explanation...")
    cleaned_text = clean_with_claude(sample_text)
    
    logging.info("ORIGINAL TEXT:")
    logging.info(sample_text)
    logging.info("-" * 50)
    logging.info("CLEANED TEXT:")
    logging.info(cleaned_text)
    logging.info("-" * 50)
    
    return cleaned_text

def process_records(limit=None, preview=True, record_id=None):
    """Process records with explanations and clean their LaTeX formatting"""
    # Build filter formula
    filter_formula = "NOT({Explanation 4o} = '')"
    if record_id:
        filter_formula = f"AND({filter_formula}, {{Record ID}} = '{record_id}')"
    
    # Get records - using pyairtable
    fields = ["Explanation 4o", "Record ID", "Test Number", "Question Number"]
    all_records = airtable.all(formula=filter_formula, fields=fields)
    
    if limit:
        all_records = all_records[:limit]
    
    logging.info(f"Found {len(all_records)} records with explanations to process")
    
    # Process records
    processed = 0
    updated = 0
    skipped = 0
    errors = 0
    
    for record in all_records:
        try:
            processed += 1
            record_id = record.get('fields', {}).get('Record ID', 'Unknown')
            test_number = record.get('fields', {}).get('Test Number', 'Unknown')
            question_number = record.get('fields', {}).get('Question Number', 'Unknown')
            explanation = record.get('fields', {}).get('Explanation 4o', '')
            
            logging.info(f"Processing record {record_id} (Test {test_number}, Question {question_number})...")
            logging.info(f"Original text (first 150 chars): {explanation[:150]}...")
            
            # Clean explanation
            cleaned_explanation = clean_with_claude(explanation)
            
            # Skip if no changes needed
            if cleaned_explanation == explanation:
                logging.info(f"No changes needed for record {record_id}")
                skipped += 1
                continue
            
            # If preview mode, just log changes
            if preview:
                logging.info(f"PREVIEW - Record {record_id} would be updated")
                logging.info(f"PREVIEW - Original (first 150 chars): {explanation[:150]}...")
                logging.info(f"PREVIEW - Cleaned (first 150 chars): {cleaned_explanation[:150]}...")
            else:
                # Update record
                airtable.update(record['id'], {'Explanation 4o': cleaned_explanation})
                logging.info(f"Updated record {record_id}")
                updated += 1
                
                # Sleep to avoid rate limits
                time.sleep(0.2)
                
        except Exception as e:
            logging.error(f"Error processing record: {e}")
            errors += 1
    
    # Log summary
    logging.info("=" * 50)
    logging.info("Summary:")
    logging.info(f"Processed: {processed}")
    logging.info(f"Updated: {updated}")
    logging.info(f"Skipped (no changes): {skipped}")
    logging.info(f"Errors: {errors}")
    logging.info("=" * 50)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Clean LaTeX formatting in Airtable explanations")
    parser.add_argument("--limit", type=int, help="Limit number of records to process")
    parser.add_argument("--record", type=str, help="Process specific record ID")
    parser.add_argument("--live", action="store_true", help="Actually update records (default is preview only)")
    parser.add_argument("--test", action="store_true", help="Run a test clean on a sample explanation")
    
    args = parser.parse_args()
    
    if args.test:
        test_cleaning()
        exit(0)
    
    logging.info(f"Starting cleanup with options: limit={args.limit}, record={args.record}, live={args.live}")
    
    process_records(
        limit=args.limit,
        preview=not args.live,
        record_id=args.record
    )
    
    logging.info("Cleanup completed!") 