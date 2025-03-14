exports.handler = async () => {
    return {
        statusCode: 200,
        body: JSON.stringify({
            API_KEY: process.env.API_KEY,
            BASE_ID: process.env.BASE_ID
        }),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // Allow CORS for client-side requests
        }
    };
};