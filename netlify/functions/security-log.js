exports.handler = async (event, context) => {
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const logData = JSON.parse(event.body);
        
        // Add server-side information
        const enhancedLog = {
            ...logData,
            ip: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown',
            country: event.headers['x-country'] || 'unknown',
            serverTimestamp: new Date().toISOString(),
            headers: {
                'user-agent': event.headers['user-agent'],
                'accept-language': event.headers['accept-language'],
                'x-forwarded-for': event.headers['x-forwarded-for']
            }
        };

        // Log to console (will appear in Netlify function logs)
        console.log('🚨 SECURITY LOG:', JSON.stringify(enhancedLog, null, 2));
        
        // If it's suspicious activity, make it more obvious
        if (logData.action === 'SUSPICIOUS_ACTIVITY') {
            console.log('⚠️  SUSPICIOUS ACTIVITY DETECTED ⚠️');
            console.log('Action:', logData.details?.activity);
            console.log('IP:', enhancedLog.ip);
            console.log('User Agent:', event.headers['user-agent']);
            console.log('Details:', JSON.stringify(logData.details, null, 2));
        }

        // TODO: You could also send to external logging service like:
        // - Webhook to Discord/Slack
        // - Database logging
        // - Email alerts for suspicious activity
        // - Third-party monitoring service

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                success: true, 
                logged: true,
                timestamp: enhancedLog.serverTimestamp
            })
        };

    } catch (error) {
        console.error('Error in security-log function:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}; 