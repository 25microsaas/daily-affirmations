// State Management Module
const STATE_VERSION = '1.0.0';
const STORAGE_KEY = 'daily_affirmations_settings';

// Check if running in service worker context
const isServiceWorker = typeof window === 'undefined' && typeof self !== 'undefined';

// Make stateManager available globally in service worker context
if (isServiceWorker) {
    self.stateManager = null; // Will be set after instantiation
}

// Default settings with types
const SUBSCRIPTION_STATUS = {
    FREE: 'free',
    PRO: 'pro',
    TRIAL: 'trial'
};

const defaultSettings = {
    showWeather: true,
    showClock: true,
    backgroundTheme: 'nature',
    cardStyle: 'minimal',
    weatherWidgetPosition: { top: '20px', left: 'auto', right: '20px' },
    fontStyle: 'default',
    textColor: '#FFFFFF',
    enableNotifications: false,
    subscriptionStatus: SUBSCRIPTION_STATUS.FREE,
    trialEndsAt: null,
    customAffirmations: [],
    customCollections: {
        personal: [],
        motivation: [],
        gratitude: [],
        success: []
    },
    favorites: {
        affirmations: [],
        backgrounds: []
    },
    favoritesMetadata: {}, // Stores metadata for favorite affirmations
    statistics: {
        totalViews: 0,
        favorites: {},
        categories: {},
        dailyStreak: 0,
        lastViewed: null,
        viewHistory: [],
        mostViewed: [],
        leastViewed: []
    }
};

class StateError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'StateError';
        this.code = code;
        this.details = details;
    }
}

class StateManager {
    constructor() {
        this.version = STATE_VERSION;
        this.currentSettings = { ...defaultSettings };
        this.listeners = new Set();
        this.autoBackupInterval = 30 * 60 * 1000; // 30 minutes
        this.initialized = false;
        this.setupAutoBackup();
        
        // Debug log current settings
        // console.debug('StateManager initialized with settings:', this.currentSettings);
    }

    // Type validators with improved error messages
    validators = {
        subscriptionStatus: (value) => ({
            isValid: Object.values(SUBSCRIPTION_STATUS).includes(value),
            message: `Invalid subscription status. Must be one of: ${Object.values(SUBSCRIPTION_STATUS).join(', ')}`
        }),
        trialEndsAt: (value) => ({
            isValid: !value || !isNaN(new Date(value).getTime()),
            message: 'Invalid trial end date format'
        }),
        customAffirmations: (value) => ({
            isValid: Array.isArray(value),
            message: 'Custom affirmations must be an array'
        }),
        customCollections: (value) => ({
            isValid: value && typeof value === 'object' &&
                Object.values(value).every(collection => Array.isArray(collection)),
            message: 'Invalid custom collections format'
        }),
        favorites: (value) => ({
            isValid: value && typeof value === 'object' && 
                Array.isArray(value.affirmations) && Array.isArray(value.backgrounds),
            message: 'Invalid favorites format'
        }),
        favoritesMetadata: (value) => ({
            isValid: value && typeof value === 'object',
            message: 'Invalid favorites metadata format'
        }),
        weatherWidgetPosition: (value) => ({
            isValid: value && typeof value === 'object' &&
                'top' in value && 'left' in value && 'right' in value,
            message: 'Invalid weather widget position format'
        }),
        statistics: (value) => ({
            isValid: value && typeof value === 'object',
            message: 'Invalid statistics format'
        }),
        cardStyle: (value) => ({
            isValid: ['glass', 'solid', 'minimal'].includes(value),
            message: 'Card style must be one of: glass, solid, minimal'
        }),
        backgroundTheme: (value) => ({
            isValid: ['nature', 'minimal', 'architecture', 'abstract'].includes(value),
            message: 'Background theme must be one of: nature, minimal, architecture, abstract'
        }),
        fontStyle: (value) => ({
            isValid: ['default', 'serif', 'monospace'].includes(value),
            message: 'Font style must be one of: default, serif, monospace'
        }),
        textColor: (value) => ({
            isValid: /^#[0-9A-Fa-f]{6}$/.test(value),
            message: 'Text color must be a valid hex color code'
        }),
        theme: (value) => ({
            isValid: !value || (typeof value === 'object' && 
                value.id && 
                value.colors && 
                value.fonts && 
                value.glassMorphism),
            message: 'Invalid theme object structure'
        })
    };

    // Setup automatic backup
    setupAutoBackup() {
        setInterval(() => this.backupState(this.currentSettings), this.autoBackupInterval);
    }

    // Subscribe to state changes
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // Notify all listeners
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.currentSettings);
            } catch (error) {
                console.error('Error in state change listener:', error);
            }
        });
    }

    // Load state with error recovery
    async loadState() {
        if (this.initialized) {
            // console.debug('State already initialized, returning current settings:', this.currentSettings);
            return this.currentSettings;
        }

        try {
            // console.debug('Loading state from storage...');
            
            // Try loading from chrome.storage.sync
            const syncData = await this.loadFromChromeStorage();
            // console.debug('Loaded from chrome.storage.sync:', syncData);
            
            // If sync storage is empty or invalid, try local storage
            if (!syncData || !this.isStateValid(syncData)) {
                // console.debug('Sync storage empty or invalid, trying local storage...');
                const localData = this.loadFromLocalStorage();
                // console.debug('Loaded from localStorage:', localData);

                if (localData && this.isStateValid(localData)) {
                    // If local storage has valid data, use it and sync back to chrome.storage
                    await this.saveState(localData);
                    this.currentSettings = localData;
                } else {
                    // If both storages are empty/invalid, use default settings
                    // console.debug('Using default settings');
                    await this.saveState(defaultSettings);
                    this.currentSettings = { ...defaultSettings };
                }
            } else {
                // Use data from sync storage
                this.currentSettings = syncData;
            }

            // Create backup
            await this.backupState(this.currentSettings);
            
            this.initialized = true;
            this.notifyListeners();
            
            // console.debug('Final state after loading:', this.currentSettings);
            return this.currentSettings;

        } catch (error) {
            console.error('Failed to load state:', error);
            // Use default settings if everything fails
            this.currentSettings = { ...defaultSettings };
            this.initialized = true;
            this.notifyListeners();
            return this.currentSettings;
        }
    }

    // Load from chrome.storage.sync
    async loadFromChromeStorage() {
        try {
            const result = await new Promise((resolve) => {
                chrome.storage.sync.get(STORAGE_KEY, (data) => {
                    if (chrome.runtime.lastError) {
                        console.error('Chrome storage error:', chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        resolve(data[STORAGE_KEY]);
                    }
                });
            });
            
            return result || null;
        } catch (error) {
            console.error('Failed to load from chrome storage:', error);
            return null;
        }
    }

    // Load from localStorage
    loadFromLocalStorage() {
        try {
            // Skip localStorage in service worker context
            if (isServiceWorker) {
                return null;
            }

            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return null;
        }
    }

    // Save state with validation
    async saveState(state) {
        try {
            // console.debug('Saving state:', state);
            
            const validatedState = this.validateState(state);
            
            // Save to chrome.storage.sync
            await new Promise((resolve, reject) => {
                chrome.storage.sync.set({ [STORAGE_KEY]: validatedState }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });

            // Save to localStorage as backup (only in browser context)
            if (!isServiceWorker) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(validatedState));
            }
            
            // Update current settings
            this.currentSettings = validatedState;
            this.notifyListeners();
            
            // console.debug('State saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save state:', error);
            throw new StateError('Failed to save state', 'SAVE_ERROR', { originalError: error });
        }
    }

    // Validate state with detailed error reporting
    validateState(state) {
        const validated = { ...defaultSettings };
        const errors = [];

        for (const [key, validator] of Object.entries(this.validators)) {
            if (key in state) {
                const { isValid, message } = validator(state[key]);
                if (isValid) {
                    validated[key] = state[key];
                } else {
                    errors.push(message);
                }
            }
        }

        // Copy non-validated fields
        for (const key in state) {
            if (!(key in this.validators)) {
                validated[key] = state[key];
            }
        }

        if (errors.length > 0) {
            console.warn('State validation warnings:', errors);
        }

        return validated;
    }

    // Backup state with improved reliability
    async backupState(state) {
        try {
            const { customBackgrounds, ...backupState } = state;
            
            // Create backup object with metadata
            const backup = {
                state: backupState,
                timestamp: Date.now(),
                version: this.version,
                checksum: this.calculateStateChecksum(backupState)
            };

            // In browser context, save to localStorage
            if (!isServiceWorker) {
                localStorage.setItem('settingsBackup', JSON.stringify(backup));
            }
            
            // Always save to chrome.storage.local
            await chrome.storage.local.set({
                settingsBackup: backup
            });

            // Keep only last 3 backups with rotation
            await this.rotateBackups();

            return true;
        } catch (error) {
            console.error('Backup creation failed:', error);
            return false;
        }
    }

    // Calculate a simple checksum for state validation
    calculateStateChecksum(state) {
        try {
            const stateStr = JSON.stringify(state);
            let hash = 0;
            
            for (let i = 0; i < stateStr.length; i++) {
                const char = stateStr.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            
            return hash.toString(16);
        } catch (error) {
            console.error('Checksum calculation failed:', error);
            return '';
        }
    }

    // Rotate backups keeping only the last 3
    async rotateBackups() {
        try {
            const result = await chrome.storage.local.get(null);
            const backups = Object.keys(result)
                .filter(key => key.startsWith('settingsBackup'))
                .map(key => ({
                    key,
                    timestamp: result[key].timestamp
                }))
                .sort((a, b) => b.timestamp - a.timestamp);

            // Keep only the last 3 backups
            if (backups.length > 3) {
                const toRemove = backups.slice(3);
                await Promise.all(
                    toRemove.map(backup => 
                        chrome.storage.local.remove(backup.key)
                    )
                );
            }
        } catch (error) {
            console.error('Backup rotation failed:', error);
        }
    }

    // Reset to defaults
    async resetToDefaults() {
        try {
            await this.saveState(defaultSettings);
        } catch (error) {
            throw new StateError(
                'Failed to reset settings',
                'RESET_ERROR',
                { originalError: error }
            );
        }
    }

    // Get current settings
    getSettings() {
        return { ...this.currentSettings };
    }

    // Update specific settings
    async updateSettings(updates) {
        try {
            // console.debug('Updating settings with:', updates);
            
            const newState = {
                ...this.currentSettings,
                ...updates
            };
            
            await this.saveState(newState);
            return true;
        } catch (error) {
            console.error('Failed to update settings:', error);
            throw new StateError('Failed to update settings', 'UPDATE_ERROR', { originalError: error });
        }
    }

    // Check if state is valid
    isStateValid(state) {
        if (!state || typeof state !== 'object') {
            // console.debug('State validation failed: state is not an object');
            return false;
        }
        
        // Check for required fields
        const requiredFields = [
            'showWeather',
            'showClock',
            'backgroundTheme',
            'cardStyle',
            'fontStyle',
            'textColor'
        ];

        const hasAllRequired = requiredFields.every(field => field in state);
        if (!hasAllRequired) {
            // console.debug('State validation failed: missing required fields');
            return false;
        }

        // Validate field values
        for (const [key, validator] of Object.entries(this.validators)) {
            if (key in state) {
                const { isValid, message } = validator(state[key]);
                if (!isValid) {
                    // console.debug(`State validation failed: ${message}`);
                    return false;
                }
            }
        }

        return true;
    }
}

// Create and export singleton instance
const stateManager = new StateManager();

// Make available in service worker context
if (isServiceWorker) {
    self.stateManager = stateManager;
}

export default stateManager;
export { SUBSCRIPTION_STATUS, StateError }; 