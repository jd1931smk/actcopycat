// 🚨 File Access Tracking System 🚨
// This script monitors when sensitive files are accessed
// and reports all activity to security monitoring

(function() {
    'use strict';

    // List of sensitive files to monitor
    const MONITORED_FILES = [
        '.env-backup',
        'db_backup_20240619.sql',
        'admin-login.html',
        'passwords.txt',
        'api-keys.txt',
        'config.env'
    ];

    // Track file access attempts
    function trackFileAccess(filename, method = 'unknown') {
        const accessData = {
            timestamp: new Date().toISOString(),
            action: 'FILE_ACCESS_ATTEMPT',
            page: 'file-access-tracker',
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer,
            filename: filename,
            accessMethod: method,
            suspiciousLevel: 'CRITICAL',
            details: {
                description: `Attempted to access sensitive file: ${filename}`,
                fileType: filename.split('.').pop(),
                stackTrace: new Error().stack,
                currentURL: window.location.href,
                timestamp: performance.now()
            }
        };

        console.log('🚨 SENSITIVE FILE ACCESS DETECTED:', accessData);

        // Send to security monitoring
        fetch('/.netlify/functions/security-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(accessData)
        }).catch(error => {
            console.error('Failed to report file access:', error);
        });
    }

    // Monitor fetch requests for sensitive files
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        if (typeof url === 'string') {
            MONITORED_FILES.forEach(file => {
                if (url.includes(file)) {
                    trackFileAccess(file, 'fetch');
                }
            });
        }
        return originalFetch.apply(this, args);
    };

    // Monitor XMLHttpRequest for sensitive files
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string') {
            MONITORED_FILES.forEach(file => {
                if (url.includes(file)) {
                    trackFileAccess(file, 'XMLHttpRequest');
                }
            });
        }
        return originalXHROpen.apply(this, [method, url, ...args]);
    };

    // Monitor direct file access via window.location changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(state, title, url) {
        if (url) {
            MONITORED_FILES.forEach(file => {
                if (url.includes(file)) {
                    trackFileAccess(file, 'pushState');
                }
            });
        }
        return originalPushState.apply(this, arguments);
    };

    history.replaceState = function(state, title, url) {
        if (url) {
            MONITORED_FILES.forEach(file => {
                if (url.includes(file)) {
                    trackFileAccess(file, 'replaceState');
                }
            });
        }
        return originalReplaceState.apply(this, arguments);
    };

    // Monitor navigation attempts
    window.addEventListener('beforeunload', function() {
        const destination = document.activeElement?.href || '';
        MONITORED_FILES.forEach(file => {
            if (destination.includes(file)) {
                trackFileAccess(file, 'navigation');
            }
        });
    });

    // Monitor link clicks
    document.addEventListener('click', function(event) {
        const target = event.target;
        if (target.tagName === 'A' && target.href) {
            MONITORED_FILES.forEach(file => {
                if (target.href.includes(file)) {
                    event.preventDefault(); // Block access
                    trackFileAccess(file, 'link_click');
                    
                    // Show fake "access denied" message
                    alert('Access Denied: Insufficient permissions.\n\nThis incident has been logged.');
                }
            });
        }
    });

    // Track attempts to access files via form submissions
    document.addEventListener('submit', function(event) {
        const form = event.target;
        const action = form.action || '';
        const formData = new FormData(form);
        
        // Check form action and data for sensitive file references
        MONITORED_FILES.forEach(file => {
            if (action.includes(file)) {
                trackFileAccess(file, 'form_submission');
            }
            
            // Check form data
            for (let [key, value] of formData.entries()) {
                if (value.toString().includes(file)) {
                    trackFileAccess(file, 'form_data');
                }
            }
        });
    });

    // Monitor console access (developer tools usage)
    let devToolsOpen = false;
    setInterval(function() {
        const threshold = 160;
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
            if (!devToolsOpen) {
                devToolsOpen = true;
                trackFileAccess('developer_tools_detected', 'console_access');
            }
        } else {
            devToolsOpen = false;
        }
    }, 1000);

    // Log that the tracker is active
    console.log('🔍 File access monitoring active for sensitive files');
    
    // Initial check of current URL
    MONITORED_FILES.forEach(file => {
        if (window.location.href.includes(file)) {
            trackFileAccess(file, 'direct_access');
        }
    });

})(); 