chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchWebsiteEmail") {
        fetch(request.url)
            .then(response => response.text())
            .then(html => {
                const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                const matches = html.match(emailRegex) || [];
                const uniqueEmails = [...new Set(matches)];
                
                // Filter out common false positives like image extensions or common strings
                const invalidDomains = ['sentry.io', 'wixpress.com', 'squarespace.com', 'example.com'];
                const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.css', '.js'];
                
                const validEmails = uniqueEmails.filter(email => {
                    const lowerEmail = email.toLowerCase();
                    const hasInvalidDomain = invalidDomains.some(domain => lowerEmail.includes(domain));
                    const hasInvalidExtension = invalidExtensions.some(ext => lowerEmail.endsWith(ext));
                    return !hasInvalidDomain && !hasInvalidExtension;
                });
                
                sendResponse({ emails: validEmails });
            })
            .catch(error => {
                console.error("Error fetching website:", error);
                sendResponse({ emails: [] });
            });
        
        return true; // Keep the message channel open for async response
    }
});
