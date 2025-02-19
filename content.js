function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoScroll() {
    const matchesContainer = document.querySelector('div[role="tabpanel"]');
    if (!matchesContainer) {
        console.error("Matches container not found");
        return 0;
    }

    let lastHeight = matchesContainer.scrollHeight;
    let noNewContent = 0;
    let currentCount = 0;
    let lastValidCount = 0;
    
    try {
        // Get initial count but don't send it yet
        currentCount = document.querySelectorAll('div[role="tabpanel"] .matchListItem').length;
        if (currentCount > 0) {
            lastValidCount = currentCount;
        }
        
        // Send a "counting" message to show we're in progress
        chrome.runtime.sendMessage({ 
            action: "updateCount", 
            count: 0,
            isError: false,
            status: "counting" 
        });
        
        while (noNewContent < 3) {
            try {
                matchesContainer.scrollTo({
                    top: matchesContainer.scrollHeight,
                    behavior: 'smooth'
                });
                
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                const newCount = document.querySelectorAll('div[role="tabpanel"] .matchListItem').length;
                
                if (newCount > currentCount) {
                    currentCount = newCount;
                    lastValidCount = Math.max(lastValidCount, currentCount);
                    noNewContent = 0;
                } else {
                    noNewContent++;
                }
                
                if (matchesContainer.scrollHeight > lastHeight) {
                    lastHeight = matchesContainer.scrollHeight;
                    noNewContent = 0;
                }
            } catch (scrollError) {
                console.error("Scroll error:", scrollError);
                noNewContent++;
            }
        }
        
        // Only send the final count after we're done scrolling
        chrome.runtime.sendMessage({ 
            action: "updateCount", 
            count: lastValidCount,
            isError: false,
            status: "complete"
        });
        
        return lastValidCount;
        
    } catch (error) {
        console.error("Auto-scroll error:", error);
        chrome.runtime.sendMessage({ 
            action: "updateCount", 
            count: lastValidCount,
            isError: true,
            status: "error"
        });
        return lastValidCount;
    }
}

async function countMatches(highlight = false, shouldAutoScroll = false) {
    try {
        let count = 0;
        if (shouldAutoScroll) {
            count = await autoScroll();
        } else {
            count = document.querySelectorAll('div[role="tabpanel"] .matchListItem').length;
        }
        
        // Remove any existing highlights and counters first
        const existingHighlights = document.querySelectorAll('div[role="tabpanel"] .matchListItem');
        existingHighlights.forEach(match => {
            match.style.border = 'none';
            const existingCounter = match.querySelector('.match-counter');
            if (existingCounter) {
                existingCounter.remove();
            }
        });
        
        // Add new highlights and counters if requested
        if (highlight) {
            const matches = document.querySelectorAll('div[role="tabpanel"] .matchListItem');
            matches.forEach((match, index) => {
                // Add highlight
                match.style.border = '2px solid #ff0000';
                
                // Add counter
                const counter = document.createElement('div');
                counter.className = 'match-counter';
                counter.textContent = index + 1;
                counter.style.cssText = `
                    position: absolute;
                    top: 5px;
                    left: 7px;
                    color: black;
                    font-size: 11px;
                    font-weight: bold;
                    z-index: 1000;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    text-shadow: 
                        -1px -1px 0 white,
                        1px -1px 0 white,
                        -1px 1px 0 white,
                        1px 1px 0 white;
                `;
                
                // Ensure the match has position relative for absolute positioning of counter
                if (window.getComputedStyle(match).position === 'static') {
                    match.style.position = 'relative';
                }
                
                match.appendChild(counter);
            });
        }
        
        return count;
    } catch (error) {
        console.error("Error counting matches:", error);
        return 0;
    }
}

// Remove borders when script is unloaded
window.addEventListener('unload', () => {
    const matches = document.querySelectorAll('div[class*="D(b) Pos(r) Expand"][aria-hidden="true"]');
    matches.forEach(match => {
        match.style.border = 'none';
    });
});

// Log when the script loads
console.log("Content script loaded");

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received:", request); // Debug log
    if (request.action === "getMatchCount") {
        // Using async/await in a message listener requires this pattern
        (async () => {
            const count = await countMatches(request.highlight, request.autoScroll);
            console.log("Sending response:", count); // Debug log
            sendResponse({ count: count });
        })();
        return true; // Keep the message channel open
    }
});
