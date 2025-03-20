const axios = require('axios');

class DeepSeekAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.deepseek.com/v1';
    }

    async generateHint(prompt) {
        try {
            const response = await axios.post(`${this.baseURL}/chat/completions`, {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 250
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('DeepSeek API Error:', error);
            throw error;
        }
    }
}

module.exports = { DeepSeekAPI }; 