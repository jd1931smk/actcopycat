const axios = require('axios');

class AnthropicAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.anthropic.com/v1';
    }

    async generateHint(prompt) {
        try {
            const response = await axios.post(`${this.baseURL}/messages`, {
                model: 'claude-3-sonnet-20240229',
                max_tokens: 250,
                temperature: 0.7,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            }, {
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                }
            });

            return response.data.content[0].text;
        } catch (error) {
            console.error('Anthropic API Error:', error);
            throw error;
        }
    }
}

module.exports = { AnthropicAPI }; 