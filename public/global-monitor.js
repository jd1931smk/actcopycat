// 🚨 GLOBAL MONITORING AND WARNING SYSTEM 🚨
// This script runs on ALL pages and shows monitoring warnings

(function() {
    'use strict';

    // Show the monitoring warning immediately
    function showMonitoringWarning() {
        // Create warning banner
        const warningBanner = document.createElement('div');
        warningBanner.id = 'monitoring-warning';
        warningBanner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(45deg, #ff0000, #ff6600);
            color: white;
            padding: 8px;
            text-align: center;
            font-family: monospace;
            font-size: 12px;
            font-weight: bold;
            z-index: 999999;
            border-bottom: 2px solid #fff;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            animation: pulse 2s infinite;
        `;
        warningBanner.innerHTML = `
            🚨 SECURITY NOTICE: This is private code and your activity is being monitored 🚨
            | IP Logged | Activity Tracked | All Access Recorded |
        `;

        // Add pulsing animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.7; }
                100% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Insert banner at the top
        document.body.insertBefore(warningBanner, document.body.firstChild);

        // Adjust body padding to account for banner
        document.body.style.paddingTop = '50px';

        // Make the banner click to show more details
        warningBanner.addEventListener('click', function() {
            alert(`⚠️ MONITORING ACTIVE ⚠️

This system monitors and logs:
• Your IP address: ${window.location.hostname}
• All page visits and navigation
• Mouse movements and clicks
• Keyboard activity
• File access attempts
• Function calls
• Browser fingerprint
• Time spent on site

All activity is recorded for security purposes.
Unauthorized access may result in legal action.

Timestamp: ${new Date().toISOString()}`);
        });

        console.log('🚨 MONITORING WARNING DISPLAYED 🚨');
    }

    // Global activity tracking
    function trackActivity(action, details = {}) {
        const trackingData = {
            timestamp: new Date().toISOString(),
            action: action,
            page: window.location.pathname,
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer,
            screen: {
                width: screen.width,
                height: screen.height
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            platform: navigator.platform,
            details: details
        };

        console.log('🔍 GLOBAL ACTIVITY TRACKED:', trackingData);

        // Send to monitoring endpoint
        fetch('/.netlify/functions/security-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(trackingData)
        }).catch(error => {
            console.error('Failed to send activity data:', error);
        });
    }

    // Monitor all function calls (intercept fetch)
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        if (typeof url === 'string' && url.includes('.netlify/functions/')) {
            console.log('🚨 FUNCTION CALL DETECTED:', url);
            trackActivity('FUNCTION_CALL_INTERCEPTED', {
                functionUrl: url,
                method: args[1]?.method || 'GET',
                suspiciousLevel: 'HIGH'
            });
            
            // Show additional warning for function calls
            if (!sessionStorage.getItem('function-warning-shown')) {
                sessionStorage.setItem('function-warning-shown', 'true');
                setTimeout(() => {
                    if (confirm('🚨 FUNCTION ACCESS DETECTED 🚨\n\nThis is private code and your activity is being monitored.\nAll function calls are logged with your IP address.\n\nContinue anyway?')) {
                        console.log('User acknowledged function access warning');
                    } else {
                        console.log('User cancelled function access');
                        return Promise.reject(new Error('Access cancelled by user'));
                    }
                }, 100);
            }
        }
        return originalFetch.apply(this, args);
    };

    // Monitor XHR requests
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (url.includes('.netlify/functions/')) {
            console.log('🚨 XHR FUNCTION CALL:', url);
            trackActivity('XHR_FUNCTION_CALL', {
                functionUrl: url,
                method: method,
                suspiciousLevel: 'HIGH'
            });
        }
        return originalXHROpen.apply(this, [method, url, ...args]);
    };

    // Initialize when page loads
    function initializeMonitoring() {
        // Show warning banner
        showMonitoringWarning();

        // Track page load
        trackActivity('GLOBAL_PAGE_LOAD', {
            loadTime: performance.now(),
            pageTitle: document.title
        });

        // Track all clicks globally
        document.addEventListener('click', function(e) {
            trackActivity('GLOBAL_CLICK', {
                target: e.target.tagName,
                id: e.target.id,
                className: e.target.className,
                text: e.target.textContent?.substring(0, 50),
                x: e.clientX,
                y: e.clientY
            });
        });

        // Track keyboard activity
        let keyCount = 0;
        document.addEventListener('keydown', function(e) {
            keyCount++;
            if (keyCount % 10 === 0) { // Log every 10 keystrokes
                trackActivity('GLOBAL_KEYBOARD_ACTIVITY', {
                    keyCount: keyCount,
                    lastKey: e.key === ' ' ? 'space' : (e.key.length === 1 ? e.key : e.key)
                });
            }
        });

        // Track page visibility changes
        document.addEventListener('visibilitychange', function() {
            trackActivity('GLOBAL_VISIBILITY_CHANGE', {
                hidden: document.hidden,
                visibilityState: document.visibilityState
            });
        });

        // Track before page unload
        window.addEventListener('beforeunload', function() {
            trackActivity('GLOBAL_PAGE_UNLOAD', {
                timeOnPage: performance.now(),
                scrollPosition: window.scrollY
            });
        });

        // Track console access attempts
        let devToolsWarningShown = false;
        setInterval(function() {
            const threshold = 160;
            if ((window.outerHeight - window.innerHeight > threshold) || 
                (window.outerWidth - window.innerWidth > threshold)) {
                if (!devToolsWarningShown) {
                    devToolsWarningShown = true;
                    console.log('🚨 DEVELOPER TOOLS DETECTED 🚨');
                    console.log('⚠️  Your developer tools usage is being monitored ⚠️');
                    trackActivity('DEVELOPER_TOOLS_DETECTED', {
                        windowSizeDelta: {
                            height: window.outerHeight - window.innerHeight,
                            width: window.outerWidth - window.innerWidth
                        },
                        suspiciousLevel: 'HIGH'
                    });
                }
            } else {
                devToolsWarningShown = false;
            }
        }, 1000);
    }

    // Start monitoring when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMonitoring);
    } else {
        initializeMonitoring();
    }

    console.log('🚨 GLOBAL MONITORING SYSTEM ACTIVE 🚨');
    console.log('⚠️  All activity on this site is being monitored and logged ⚠️');

})(); 