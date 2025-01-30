// Service Worker for offline support
importScripts('/js/modules/state.js');

const CACHE_VERSION = 'v1';
const DB_NAME = 'DailyAffirmationsDB';
const ASSETS_STORE = 'assets';
const OFFLINE_URL = 'offline.html';

const ASSETS_TO_CACHE = [
    // HTML
    '/newtab.html',
    '/offline.html',
    
    // CSS
    '/css/fonts.css',
    '/css/premium.css',
    '/css/styles.css',
    
    // Fonts
    '/fonts/MaterialIcons-Regular.woff2',
    '/fonts/MaterialIcons-Regular.woff',
    '/fonts/Inter-Regular.woff2',
    '/fonts/Inter-Regular.woff',
    '/fonts/Inter-Medium.woff2',
    '/fonts/Inter-Medium.woff',
    '/fonts/Inter-SemiBold.woff2',
    '/fonts/Inter-SemiBold.woff',
    
    // Images
    '/images/backgrounds/default-1.jpeg',
    '/images/backgrounds/default-2.jpeg',
    '/images/backgrounds/default-3.jpeg',
    '/images/backgrounds/default-4.jpeg',
    '/images/backgrounds/default-5.jpeg',
    '/images/backgrounds/default-1-thumb.jpeg',
    '/images/backgrounds/default-2-thumb.jpeg',
    '/images/backgrounds/default-3-thumb.jpeg',
    '/images/icon-16.png',
    '/images/icon-32.png',
    '/images/icon-48.png',
    '/images/icon-128.png',
    
    // JavaScript
    '/js/app.js',
    '/js/init.js',
    '/js/shepherd.min.js',
    '/css/shepherd.css'
];

// Initialize state manager
const stateManager = new StateManager();

// Open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(ASSETS_STORE)) {
                db.createObjectStore(ASSETS_STORE, { keyPath: 'url' });
            }
            if (!db.objectStoreNames.contains('unsynced')) {
                db.createObjectStore('unsynced', { keyPath: 'id' });
            }
        };
    });
}

// Store asset in IndexedDB
async function storeAsset(url, response) {
    const db = await openDB();
    const tx = db.transaction(ASSETS_STORE, 'readwrite');
    const store = tx.objectStore(ASSETS_STORE);
    
    const blob = await response.blob();
    await store.put({
        url,
        blob,
        timestamp: Date.now()
    });
    
    return tx.complete;
}

// Get asset from IndexedDB
async function getAsset(url) {
    const db = await openDB();
    const tx = db.transaction(ASSETS_STORE, 'readonly');
    const store = tx.objectStore(ASSETS_STORE);
    const asset = await store.get(url);
    
    if (!asset) return null;
    
    return new Response(asset.blob, {
        headers: {
            'Content-Type': asset.blob.type
        }
    });
}

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        (async () => {
            console.log('Caching app assets');
            const db = await openDB();
            const baseUrl = self.registration.scope;
            
            // Cache each asset
            for (const assetPath of ASSETS_TO_CACHE) {
                const url = new URL(assetPath, baseUrl).href;
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${url}`);
                    }
                    await storeAsset(url, response.clone());
                } catch (error) {
                    console.warn(`Failed to cache ${url}:`, error);
                }
            }
            
            await self.skipWaiting();
        })()
    );
});

// Activate event - clean up old data
self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            // Here we could clean up old versions if needed
            await self.clients.claim();
        })()
    );
});

// Fetch event - serve from IndexedDB or network
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Only handle requests from our extension
    if (!url.href.startsWith(self.registration.scope)) {
        return;
    }

    event.respondWith(
        (async () => {
            try {
                // Try to get from IndexedDB first
                const cachedResponse = await getAsset(url.href);
                if (cachedResponse) {
                    return cachedResponse;
                }

                // If not in IndexedDB, fetch from network
                const response = await fetch(event.request);
                if (!response || response.status !== 200) {
                    return response;
                }

                // Store in IndexedDB for next time
                await storeAsset(url.href, response.clone());
                return response;
            } catch (error) {
                console.error('Fetch failed:', error);
                
                // If offline and requesting the main page
                if (event.request.mode === 'navigate') {
                    const offlineResponse = await getAsset(new URL(OFFLINE_URL, self.registration.scope).href);
                    if (offlineResponse) {
                        return offlineResponse;
                    }
                }
                
                throw error;
            }
        })()
    );
});

// Handle background sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-affirmations') {
        event.waitUntil(syncAffirmations());
    }
});

// Sync affirmations when online
async function syncAffirmations() {
    const db = await openDB();
    const tx = db.transaction('unsynced', 'readonly');
    const store = tx.objectStore('unsynced');
    const unsynced = await store.getAll();
    
    for (const item of unsynced) {
        try {
            // Attempt to sync
            await fetch('/api/sync', {
                method: 'POST',
                body: JSON.stringify(item)
            });
            
            // Remove from unsynced if successful
            const deleteTx = db.transaction('unsynced', 'readwrite');
            await deleteTx.objectStore('unsynced').delete(item.id);
            await deleteTx.complete;
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }
}

// Initialize the service worker
async function initialize() {
    try {
        console.debug('Initializing service worker...');
        
        // Load settings first
        const settings = await stateManager.loadState();
        if (!settings) {
            throw new Error('Failed to load settings');
        }
        
        // Setup alarm if reminders are enabled
        if (settings.reminderEnabled) {
            await setupDailyReminder(settings.reminderTime);
        }
        
        // Listen for settings changes
        stateManager.addListener(handleSettingsChange);
        
        console.debug('Service worker initialized successfully');
    } catch (error) {
        console.error('Service worker initialization failed:', error);
    }
}

// Handle settings changes
async function handleSettingsChange(settings) {
    try {
        console.debug('Settings changed:', settings);
        
        // Update reminder if needed
        if (settings.reminderEnabled) {
            await setupDailyReminder(settings.reminderTime);
        } else {
            await chrome.alarms.clear('dailyReminder');
        }
    } catch (error) {
        console.error('Failed to handle settings change:', error);
    }
}

// Setup daily reminder
async function setupDailyReminder(time) {
    try {
        // Clear existing alarm
        await chrome.alarms.clear('dailyReminder');
        
        // Parse time string
        const [hours, minutes] = time.split(':').map(Number);
        
        // Calculate when the alarm should next fire
        const now = new Date();
        let reminderTime = new Date(now);
        reminderTime.setHours(hours, minutes, 0, 0);
        
        // If the time has already passed today, set it for tomorrow
        if (reminderTime < now) {
            reminderTime.setDate(reminderTime.getDate() + 1);
        }
        
        // Create the alarm
        await chrome.alarms.create('dailyReminder', {
            when: reminderTime.getTime(),
            periodInMinutes: 24 * 60 // Repeat daily
        });
        
        console.debug('Daily reminder set for:', reminderTime);
    } catch (error) {
        console.error('Failed to setup daily reminder:', error);
    }
}

// Listen for alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'dailyReminder') {
        try {
            const settings = await stateManager.loadState();
            
            // Check if reminders are still enabled and if it's a reminder day
            if (settings.reminderEnabled) {
                const today = new Date().toLocaleString('en-US', { weekday: 'long' });
                if (settings.reminderDays.includes(today)) {
                    await showReminder();
                }
            }
        } catch (error) {
            console.error('Failed to handle reminder alarm:', error);
        }
    }
});

// Show reminder notification
async function showReminder() {
    try {
        await chrome.notifications.create('dailyReminder', {
            type: 'basic',
            iconUrl: '/images/icon-128.png',
            title: 'Daily Affirmation',
            message: 'Time to check your daily affirmation!',
            priority: 2
        });
    } catch (error) {
        console.error('Failed to show reminder notification:', error);
    }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    initialize().catch(error => {
        console.error('Failed to initialize on install:', error);
    });
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    initialize().catch(error => {
        console.error('Failed to initialize on startup:', error);
    });
}); 