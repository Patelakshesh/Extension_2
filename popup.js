document.getElementById('startScraping').addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let limit = document.getElementById('limit').value;

    if (!tab.url.includes("google.com/maps")) {
        alert("Please open Google Maps to use this scraper.");
        return;
    }

    // Send the start message directly to the injected content script
    chrome.tabs.sendMessage(tab.id, { action: "start", limit: parseInt(limit) }, (response) => {
        if (chrome.runtime.lastError) {
            alert("Please refresh the Google Maps page and try again.");
            console.error(chrome.runtime.lastError);
            return;
        }
        window.close(); // Close the popup after starting
    });
});
