document.addEventListener('DOMContentLoaded', function() {
    const matchCount = document.getElementById('matchCount');
    const error = document.getElementById('error');
    const highlightToggle = document.getElementById('highlightToggle');
    const refreshButton = document.getElementById('refreshButton');
    
    let lastValidCount = 0;
    
    // Load saved count when popup opens
    chrome.storage.local.get(['lastMatchCount'], function(result) {
        if (result.lastMatchCount) {
            lastValidCount = result.lastMatchCount;
            matchCount.textContent = result.lastMatchCount;
        }
    });
    
    function refreshCount() {
        refreshButton.disabled = true;
        refreshButton.textContent = "Counting...";
        matchCount.textContent = "counting...";
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentTab = tabs[0];
            
            if (!currentTab.url.includes('tinder.com')) {
                matchCount.textContent = '-';
                error.textContent = 'Please open Tinder to count matches';
                refreshButton.disabled = false;
                refreshButton.textContent = "Calculate matches";
                return;
            }
            
            // Reset stored count to force fresh count
            chrome.storage.local.remove('lastMatchCount', function() {
                chrome.tabs.sendMessage(
                    currentTab.id, 
                    { 
                        action: "getMatchCount",
                        highlight: highlightToggle.checked,
                        autoScroll: true  // Always auto-scroll when calculating
                    }
                );
            });
        });
    }
    
    // Handle count updates with status
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "updateCount") {
            if (request.status === "counting") {
                matchCount.textContent = "counting...";
                refreshButton.disabled = true;
                refreshButton.textContent = "Counting...";
            } 
            else if (request.status === "complete" && request.count > 0) {
                lastValidCount = request.count;
                
                // Save the new count
                chrome.storage.local.set({ lastMatchCount: lastValidCount });
                
                // Update display
                matchCount.textContent = lastValidCount;
                refreshButton.disabled = false;
                refreshButton.textContent = "Calculate matches";
                error.textContent = '';
            }
            else if (request.status === "error") {
                error.textContent = request.errorMessage || 'Error during count';
                refreshButton.disabled = false;
                refreshButton.textContent = "Calculate matches";
            }
        }
    });
    
    refreshButton.addEventListener('click', refreshCount);
    highlightToggle.addEventListener('change', () => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(
                tabs[0].id, 
                { 
                    action: "getMatchCount",
                    highlight: highlightToggle.checked,
                    autoScroll: false  // Don't auto-scroll for highlight toggle
                }
            );
        });
    });
    
    // Initial highlight state check
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].url.includes('tinder.com')) {
            chrome.tabs.sendMessage(
                tabs[0].id, 
                { 
                    action: "getMatchCount",
                    highlight: highlightToggle.checked,
                    autoScroll: false
                }
            );
        }
    });

    // Add coffee link handler
    document.getElementById('coffeeLink').addEventListener('click', function() {
        chrome.tabs.create({ url: 'https://x.com' });
    });
});
