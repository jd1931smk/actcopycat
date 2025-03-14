from flask import Flask, jsonify, send_from_directory
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

@app.route('/')
def serve_html():
    return send_from_directory('.', 'render clone.html')  # Ensure this matches the file name exactly

@app.route('/config')
def config():
    return jsonify({
        'API_KEY': os.getenv('AIRTABLE_API_KEY'),
        'BASE_ID': os.getenv('BASE_ID')
    })

if __name__ == '__main__':
    app.run(port=3000, debug=True)  # Debug mode for detailed errors