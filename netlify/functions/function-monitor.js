// 🚨 UNIVERSAL FUNCTION MONITORING SYSTEM 🚨
// This function monitors and logs ALL access to Netlify Functions
// Deployed as middleware to catch any function execution

exports.handler = async (event, context) => {
    // Get visitor information
    const clientIP = event.headers['x-forwarded-for'] || 
                    event.headers['x-real-ip'] || 
                    context.clientContext?.ip || 
                    'unknown';
    
    const userAgent = event.headers['user-agent'] || 'unknown';
    const origin = event.headers.origin || 'unknown';
    const referer = event.headers.referer || 'unknown';
    
    // Log the function access attempt
    const accessLog = {
        timestamp: new Date().toISOString(),
        action: 'FUNCTION_ACCESS_ATTEMPT',
        functionPath: event.path,
        method: event.httpMethod,
        ip: clientIP,
        userAgent: userAgent,
        origin: origin,
        referer: referer,
        headers: event.headers,
        queryParams: event.queryStringParameters,
        suspiciousLevel: 'HIGH',
        message: 'Someone is attempting to access internal functions'
    };
    
    // Enhanced logging
    console.log('🚨🔧 FUNCTION ACCESS DETECTED 🔧🚨');
    console.log('⚠️  PRIVATE CODE ACCESS ATTEMPT ⚠️');
    console.log('Function:', event.path);
    console.log('Method:', event.httpMethod);
    console.log('IP:', clientIP);
    console.log('User Agent:', userAgent);
    console.log('Full Details:', JSON.stringify(accessLog, null, 2));
    console.log('🔒 ACTIVITY IS BEING MONITORED AND RECORDED 🔒');
    
    // Return the warning message
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'X-Security-Warning': 'This is private code and your activity is being monitored'
        },
        body: JSON.stringify({
            warning: "⚠️ SECURITY NOTICE ⚠️",
            message: "This is private code and your activity is being monitored.",
            details: "All access attempts are logged including your IP address, browser information, and activity patterns.",
            timestamp: new Date().toISOString(),
            incident_id: `INC-${Date.now()}`,
            monitored: true,
            ip_logged: clientIP !== 'unknown',
            contact: "Unauthorized access may result in legal action."
        })
    };
}; 