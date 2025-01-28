// Service Worker for offline support
const CACHE_NAME = 'daily-affirmations-v1';
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

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching app assets');
                // Convert relative URLs to absolute chrome-extension:// URLs
                const baseUrl = self.registration.scope;
                const urlsToCache = ASSETS_TO_CACHE.map(url => new URL(url, baseUrl).href);
                return Promise.all(
                    urlsToCache.map(url =>
                        fetch(url)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`Failed to fetch ${url}`);
                                }
                                return cache.put(url, response);
                            })
                            .catch(error => {
                                console.warn(`Failed to cache ${url}:`, error);
                            })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Only handle requests from our extension
    if (!url.href.startsWith(self.registration.scope)) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(response => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        // Cache the fetched response
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(error => {
                        console.error('Fetch failed:', error);
                        
                        // If offline and requesting the main page
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }

                        return null;
                    });
            })
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
    const unsynced = await db.getAll('unsynced');
    
    for (const item of unsynced) {
        try {
            // Attempt to sync
            await fetch('/api/sync', {
                method: 'POST',
                body: JSON.stringify(item)
            });
            
            // Remove from unsynced if successful
            await db.delete('unsynced', item.id);
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }
}

// Open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AffirmationsDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('unsynced')) {
                db.createObjectStore('unsynced', { keyPath: 'id' });
            }
        };
    });
} 