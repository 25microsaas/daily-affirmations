// Background Service Worker
const STATE_VERSION = '1.0.0';
const STORAGE_KEY = 'daily_affirmations_settings';

// State management within service worker
const stateManager = {
    currentSettings: null,
    listeners: new Set(),

    async loadState() {
        try {
            const result = await chrome.storage.sync.get(STORAGE_KEY);
            this.currentSettings = result[STORAGE_KEY] || null;
            return this.currentSettings;
        } catch (error) {
            console.error('Failed to load state in service worker:', error);
            return null;
        }
    },

    async updateSettings(updates) {
        try {
            const currentState = await this.loadState();
            const newState = {
                ...currentState,
                ...updates
            };
            await chrome.storage.sync.set({ [STORAGE_KEY]: newState });
            this.currentSettings = newState;
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('Failed to update settings in service worker:', error);
            return false;
        }
    },

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    },

    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.currentSettings);
            } catch (error) {
                console.error('Error in state change listener:', error);
            }
        });
    }
};

// Initialize state manager
let initialized = false;

// Initialize the service worker
async function initialize() {
    if (initialized) return;

    try {
        // console.debug('Initializing background service worker...');
        
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
        stateManager.subscribe(handleSettingsChange);
        
        initialized = true;
        // console.debug('Background service worker initialized successfully');
    } catch (error) {
        console.error('Background service worker initialization failed:', error);
    }
}

// Handle settings changes
async function handleSettingsChange(settings) {
    try {
        // console.debug('Settings changed in background worker:', settings);
        
        // Update reminder if needed
        if (settings.reminderEnabled) {
            await setupDailyReminder(settings.reminderTime);
        } else {
            await chrome.alarms.clear('dailyReminder');
        }
    } catch (error) {
        console.error('Failed to handle settings change in background:', error);
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
        
        // console.debug('Daily reminder set for:', reminderTime);
    } catch (error) {
        console.error('Failed to setup daily reminder:', error);
    }
}

// Initialize on install
if (chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(() => {
        initialize().catch(error => {
            console.error('Failed to initialize on install:', error);
        });
    });
}

// Initialize on startup
if (chrome.runtime && chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
        initialize().catch(error => {
            console.error('Failed to initialize on startup:', error);
        });
    });
}

// Handle extension icon click
if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener(() => {
        chrome.tabs.create({});  // Will automatically use newtab.html due to chrome_url_overrides
    });
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data.type === 'INIT') {
        // console.log('Service Worker initialized with API keys');
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