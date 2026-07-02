let isRunning = false;
window.stopScraping = false;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start") {
        if (!isRunning) {
            let limit = request.limit || 150;
            startScraping(limit); // Use the limit from popup
        }
        sendResponse({ status: "started" });
    }
});

// Helper: Async delay
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// SECURITY FIX: Random Async delay to mimic human behavior and avoid bot detection
async function randomDelay(min, max) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
}

// SECURITY FIX: Human-like scrolling to avoid bot detection
async function humanScroll(element) {
    let currentScroll = element.scrollTop;
    let targetScroll = element.scrollHeight;
    let distance = targetScroll - currentScroll;
    
    // Scroll down in 3 to 6 smaller steps (like scrolling a mouse wheel)
    let steps = Math.floor(Math.random() * 4) + 3; 
    let stepAmount = distance / steps;

    for(let i=0; i<steps; i++) {
        currentScroll += stepAmount;
        element.scrollTo(0, currentScroll);
        await randomDelay(150, 400); // short pause between wheel ticks
    }
    // Ensure we hit the absolute bottom
    element.scrollTo(0, element.scrollHeight);
}

// Helper: Wait for an element to appear in the DOM
function waitForElement(selector, timeout) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(true);
        }
        let observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(true);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            resolve(false);
        }, timeout);
    });
}

// UI: Show a floating banner to indicate scraping progress
function showBanner() {
    if (document.getElementById('scraper-banner')) return;
    let banner = document.createElement('div');
    banner.id = 'scraper-banner';
    banner.style.position = 'fixed';
    banner.style.bottom = '20px';
    banner.style.right = '20px';
    banner.style.backgroundColor = '#1a73e8';
    banner.style.color = 'white';
    banner.style.padding = '20px';
    banner.style.borderRadius = '8px';
    banner.style.zIndex = '999999';
    banner.style.fontFamily = 'sans-serif';
    banner.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    
    banner.innerHTML = `
        <h3 style="margin: 0 0 10px 0; font-size: 18px;">Google Maps Master Scraper</h3>
        <p id="scraper-status" style="margin: 0 0 15px 0; font-size: 14px;">Processed: 0 | Leads Saved: 0</p>
        <button id="scraper-stop" style="padding: 8px 12px; font-size: 14px; cursor: pointer; background: #ff4757; color: white; border: none; border-radius: 4px;">Stop & Export</button>
    `;
    document.body.appendChild(banner);
    
    document.getElementById('scraper-stop').addEventListener('click', () => {
        window.stopScraping = true;
        document.getElementById('scraper-stop').innerText = "Stopping safely...";
    });
}

function updateBanner(count, total) {
    let status = document.getElementById('scraper-status');
    if (status) {
        status.innerText = `Processed: ${total} | Leads Saved: ${count}`;
    }
}

function removeBanner() {
    let banner = document.getElementById('scraper-banner');
    if (banner) banner.remove();
}

// Core Logic: Extract data from the detail pane
async function extractData() {
    let data = {
        Name: "",
        Phone: "Not available",
        Address: "Not available",
        Website: "No Website",
        Email: "Not available",
        SocialLinks: "None",
        Category: "Not available",
        Rating: "Not available",
        Reviews: "Not available",
        Hours: "Not available"
    };

    // Name Extraction
    let nameEl = document.querySelector('h1.DUwDvf, h1.fontHeadlineLarge');
    if (!nameEl) {
        let nameEls = Array.from(document.querySelectorAll('h1'));
        nameEl = nameEls.find(el => el.innerText.trim() && el.innerText.trim() !== "Results" && !el.innerText.trim().startsWith("Sponsored"));
    }
    if (nameEl) data.Name = nameEl.innerText.trim();
    
    // Rating & Reviews Extraction
    let ratingEl = document.querySelector('div[role="img"][aria-label*="stars"]') || document.querySelector('div[role="img"][aria-label*="star"]');
    if (ratingEl) {
        let aria = ratingEl.getAttribute('aria-label');
        let parts = aria.split(' ');
        if (parts.length > 0) data.Rating = parts[0];
        
        let reviewMatch = aria.match(/([\d,]+)\s*(reviews|Reviews)/) || aria.match(/([\d,]+)\s*(review|Review)/);
        if (reviewMatch) data.Reviews = reviewMatch[1];
    } else {
        let fallbackReview = document.querySelector('.F7nice');
        if (fallbackReview) {
            let parts = fallbackReview.innerText.split('\n');
            if (parts.length >= 2) {
                data.Rating = parts[0].trim();
                data.Reviews = parts[1].replace(/[()]/g, '').trim();
            }
        }
    }
    
    // Category Extraction
    let categoryBtn = document.querySelector('button[jsaction*="category"]') || document.querySelector('.skqhld') || document.querySelector('.fontBodyMedium.RNmBde');
    if (categoryBtn) {
        let text = categoryBtn.innerText.trim();
        if (text) data.Category = text;
    }

    // Address Extraction
    let addressBtn = document.querySelector('button[data-item-id="address"]') || 
                     document.querySelector('button[data-tooltip="Copy address"]') ||
                     document.querySelector('button[aria-label^="Address:"]');
    if (addressBtn) {
        let addressText = addressBtn.innerText.trim();
        if (!addressText && addressBtn.getAttribute('aria-label')) {
            addressText = addressBtn.getAttribute('aria-label').replace(/^Address:?\s*/i, '').trim();
        }
        if (addressText) data.Address = addressText;
    } else {
        let fallbackAddr = document.querySelector('div.Io6YTe.fontBodyMedium[aria-label^="Address:"]');
        if (fallbackAddr) data.Address = fallbackAddr.innerText.trim();
    }

    // Phone Extraction
    let phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]') || 
                   document.querySelector('button[data-tooltip="Copy phone number"]') ||
                   document.querySelector('button[aria-label^="Phone:"]');
    if (phoneBtn) {
        let phoneText = phoneBtn.innerText.trim();
        if (!phoneText && phoneBtn.getAttribute('aria-label')) {
            phoneText = phoneBtn.getAttribute('aria-label').replace(/^Phone:?\s*/i, '').trim();
        }
        if (phoneText) data.Phone = phoneText;
    } else {
        let allDivs = Array.from(document.querySelectorAll('div.Io6YTe'));
        let phoneDiv = allDivs.find(d => /^[\d\s+()-]{7,20}$/.test(d.innerText.trim()));
        if (phoneDiv) data.Phone = phoneDiv.innerText.trim();
    }

    // Website Extraction
    let websiteLink = document.querySelector('a[data-item-id="authority"]') ||
                      document.querySelector('a[data-tooltip="Open website"]') ||
                      document.querySelector('a[aria-label^="Website:"]');
    if (websiteLink) {
        data.Website = websiteLink.href;
    }

    let allLinks = Array.from(document.querySelectorAll('a[href]'));
    let socials = [];
    allLinks.forEach(a => {
        let href = a.href;
        if (href.includes('facebook.com') || href.includes('instagram.com') || href.includes('twitter.com') || href.includes('x.com') || href.includes('linkedin.com')) {
            socials.push(href);
        }
        if (!href.includes('google.com') && !href.includes('facebook.com') && !href.includes('instagram.com') && data.Website === "No Website" && a.getAttribute('data-item-id') === 'authority') {
            data.Website = href;
        }
    });
    
    if (socials.length > 0) {
        data.SocialLinks = socials.join(', ');
    }

    // ── EMAIL EXTRACTION (From External Website) ──────────────
    if (data.Website !== "No Website") {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: "fetchWebsiteEmail", url: data.Website }, (res) => {
                    if (chrome.runtime.lastError) resolve({ emails: [] });
                    else resolve(res || { emails: [] });
                });
            });
            if (response.emails && response.emails.length > 0) {
                data.Email = response.emails.join(', ');
            }
        } catch (e) {
            console.error("Failed to fetch email:", e);
        }
    }


    let hoursDiv = document.querySelector('div[aria-label*="Hours:"], div[aria-label*="hours"]');
    if (hoursDiv && hoursDiv.getAttribute('aria-label')) {
        data.Hours = hoursDiv.getAttribute('aria-label').replace(/hide open hours/i, '').trim();
    } else {
        let hoursBtn = document.querySelector('button[data-item-id="oh"]') || 
                       document.querySelector('div[data-hide-tooltip-on-mouse-down="true"][aria-label*="time"]') ||
                       document.querySelector('.OqSTJd'); // A common class for hours
        if (hoursBtn) {
            let label = hoursBtn.getAttribute('aria-label') || hoursBtn.innerText;
            if (label) data.Hours = label.replace(/hide open hours/i, '').trim();
        }
    }

    return data;
}

// Export logic: Convert JSON array to CSV and trigger download
function exportToCSV(results) {
    if (results.length === 0) {
        alert("Scraping finished. No valid leads found.");
        return;
    }

    const headers = ["Name", "Phone", "Address", "Website", "Email", "SocialLinks", "Category", "Rating", "Reviews", "Hours"];
    const csvRows = [];
    
    csvRows.push(headers.join(','));
    
    for (const row of results) {
        const values = headers.map(header => {
            let val = row[header] ? row[header].toString() : "";
            val = val.replace(/"/g, '""');
            if (val.search(/("|,|\n)/g) >= 0) {
                val = `"${val}"`;
            }
            return val;
        });
        csvRows.push(values.join(','));
    }
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'google_maps_leads.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Main Controller
async function startScraping(maxResults) {
    isRunning = true;
    window.stopScraping = false;
    let results = [];
    let processedLinks = new Set();
    let retries = 0;
    
    // Load previously scraped links from memory
    const storageData = await chrome.storage.local.get(['globalScrapedLinks']);
    const globalScrapedLinks = new Set(storageData.globalScrapedLinks || []);
    let newlyScrapedCount = 0;

    
    showBanner();
    
    while (processedLinks.size < maxResults && retries < 5 && !window.stopScraping) {
        let feed = document.querySelector('div[role="feed"]');
        if (!feed) {
            await randomDelay(1000, 2000);
            retries++;
            continue;
        }
        
        let links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
        let unprocessed = links.find(link => !processedLinks.has(link.href) && !globalScrapedLinks.has(link.href));
        
        // If we only find links we've already globally scraped, just add them to the local processedLinks so we scroll past them
        if (!unprocessed) {
            let globallyProcessed = links.find(link => !processedLinks.has(link.href) && globalScrapedLinks.has(link.href));
            if (globallyProcessed) {
                processedLinks.add(globallyProcessed.href);
                // Scroll past it quickly without clicking
                globallyProcessed.scrollIntoView({ block: 'center' });
                continue; 
            }
        }
        
        if (unprocessed) {
            retries = 0;
            let currentUrl = unprocessed.href;
            processedLinks.add(currentUrl);
            
            // SECURITY FIX: Smooth scrolling to the element
            unprocessed.scrollIntoView({ block: 'center', behavior: 'smooth' });
            
            // SECURITY FIX: Random human-like pause before clicking
            await randomDelay(600, 1400); 
            unprocessed.click();
            
            let detailsLoaded = await new Promise(resolve => {
                let checks = 0;
                let interval = setInterval(() => {
                    let h1s = Array.from(document.querySelectorAll('h1'));
                    let validH1 = h1s.find(h => h.innerText.trim() && h.innerText.trim() !== "Results");
                    if (validH1) {
                        clearInterval(interval);
                        resolve(true);
                    }
                    if (checks > 40) { // 8 seconds max
                        clearInterval(interval);
                        resolve(false);
                    }
                    checks++;
                }, 200);
            });
            if (detailsLoaded) {
                // SECURITY FIX: Random "reading" time before pulling data
                await randomDelay(2000, 4500); 
                
                let data = await extractData();
                
                // RULE: Keep all leads (with and without website)
                // RULE: Skip if NO Phone AND NO Email
                if (data.Phone !== "Not available" || data.Email !== "Not available") {
                    results.push(data);
                    newlyScrapedCount++;
                } else {
                    console.log("Skipping lead: No phone and no email.", data.Name);
                }
                
                // Add to our global memory so we never scrape it again
                globalScrapedLinks.add(currentUrl);
                
                updateBanner(newlyScrapedCount, processedLinks.size);
            }
            
            let backButton = Array.from(document.querySelectorAll('button')).find(b => 
                (b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('Back')) || 
                (b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('Search'))
            );
            
            // SECURITY FIX: Random pause before going back
            await randomDelay(500, 1200);

            if (backButton) {
                backButton.click();
            } else {
                window.history.back();
            }
            
            await waitForElement('div[role="feed"]', 10000);
            
            // SECURITY FIX: Random pause after returning to the list
            await randomDelay(1000, 2500);
            
        } else {
            // SECURITY FIX: Human-like mouse-wheel style scrolling
            let previousHeight = feed.scrollHeight;
            await humanScroll(feed);
            
            // Random wait while "loading"
            await randomDelay(1500, 3500);
            
            if (feed.scrollHeight === previousHeight) {
                retries++;
            } else {
                retries = 0;
            }
        }
    }
    
    removeBanner();
    
    // Save updated memory back to storage
    await chrome.storage.local.set({ globalScrapedLinks: Array.from(globalScrapedLinks) });
    
    exportToCSV(results);
    isRunning = false;
}