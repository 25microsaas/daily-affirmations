// Background Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated.');
    event.waitUntil(clients.claim());
});

// Handle extension icon click
chrome.action.onClicked.addListener(async () => {
    // Check for existing tabs with our extension
    const tabs = await chrome.tabs.query({url: 'chrome://newtab/'});
    
    if (tabs.length > 0) {
        // If a new tab with our extension exists, focus it
        await chrome.tabs.update(tabs[0].id, {active: true});
        await chrome.windows.update(tabs[0].windowId, {focused: true});
    } else {
        // Create a new tab only if none exists
        chrome.tabs.create({url: 'chrome://newtab/'});
    }
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data.type === 'INIT') {
        // Initialize with API keys
        console.log('Service Worker initialized with API keys');
    }
});

// Handle fetch events
self.addEventListener('fetch', (event) => {
    // Add CORS headers for API requests
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request.url, {
                method: event.request.method,
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors',
                credentials: 'same-origin'
            })
        );
    }
}); 