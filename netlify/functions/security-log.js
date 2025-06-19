// Known honeypot API keys that should trigger alerts
const HONEYPOT_KEYS = [
    'patHONEYPOT123456789.abcdefghijklmnopqrstuvwxyz1234567890abcdef',
    'sk-fake123456789abcdefghijklmnopqrstuvwxyz1234567890',
    'sk-ant-fake123456789abcdefghijklmnopqrstuvwxyz1234567890',
    'AKIAFAKE123456789012',
    'fakesecretkey123456789abcdefghijklmnopqr',
    'fake_admin_password_123',
    'honeypot_user',
    'fake_password_123'
];

// Check if the tracking data contains honeypot content
function checkForHoneypotContent(data) {
    const dataString = JSON.stringify(data).toLowerCase();
    return HONEYPOT_KEYS.some(key => dataString.includes(key.toLowerCase()));
}

exports.handler = async (event, context) => {
    // 🚨 SECURITY LOGGING FUNCTION ACCESS 🚨
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    const userAgent = event.headers['user-agent'] || 'unknown';
    
    console.log('🚨🛡️ SECURITY LOGGING FUNCTION ACCESSED 🛡️🚨');
    console.log('⚠️  This is private security code and your activity is being monitored ⚠️');
    console.log('IP:', clientIP);
    console.log('User Agent:', userAgent);
    console.log('Method:', event.httpMethod);
    console.log('🔒 SECURITY FUNCTION ACCESS LOGGED 🔒');

    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'X-Security-Warning': 'This is private code and your activity is being monitored',
                'X-Function': 'security-log',
                'X-Access-Logged': 'true'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const logData = JSON.parse(event.body);
        
        // Check for honeypot content
        const isHoneypotTriggered = checkForHoneypotContent(logData);
        
        // Add server-side information
        const enhancedLog = {
            ...logData,
            ip: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown',
            country: event.headers['x-country'] || 'unknown',
            serverTimestamp: new Date().toISOString(),
            honeypotTriggered: isHoneypotTriggered,
            headers: {
                'user-agent': event.headers['user-agent'],
                'accept-language': event.headers['accept-language'],
                'x-forwarded-for': event.headers['x-forwarded-for']
            }
        };

        // Enhanced logging for honeypot triggers
        if (isHoneypotTriggered) {
            console.log('🚨🍯🔥 HONEYPOT TRIGGERED - CRITICAL ALERT 🔥🍯🚨');
            console.log('SOMEONE IS USING STOLEN CREDENTIALS!');
            console.log('IP:', enhancedLog.ip);
            console.log('User Agent:', event.headers['user-agent']);
            console.log('Full Data:', JSON.stringify(enhancedLog, null, 2));
            console.log('🔥🔥🔥 IMMEDIATE ATTENTION REQUIRED 🔥🔥🔥');
        } else {
            // Log to console (will appear in Netlify function logs)
            console.log('🚨 SECURITY LOG:', JSON.stringify(enhancedLog, null, 2));
        }
        
        // If it's suspicious activity, make it more obvious
        if (logData.action === 'SUSPICIOUS_ACTIVITY') {
            console.log('⚠️  SUSPICIOUS ACTIVITY DETECTED ⚠️');
            console.log('Action:', logData.details?.activity);
            console.log('IP:', enhancedLog.ip);
            console.log('User Agent:', event.headers['user-agent']);
            console.log('Details:', JSON.stringify(logData.details, null, 2));
        }

        // Special logging for honeypot-specific actions
        if (logData.action?.includes('HONEYPOT')) {
            console.log('🍯🍯🍯 HONEYPOT ACTIVITY 🍯🍯🍯');
            console.log('Activity:', logData.action);
            console.log('IP:', enhancedLog.ip);
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
                'Access-Control-Allow-Headers': 'Content-Type',
                'X-Security-Warning': 'This is private code and your activity is being monitored',
                'X-Function': 'security-log',
                'X-Access-Logged': 'true',
                'X-IP-Tracked': clientIP
            },
            body: JSON.stringify({ 
                success: true, 
                logged: true,
                timestamp: enhancedLog.serverTimestamp,
                warning: "This is private code and your activity is being monitored"
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