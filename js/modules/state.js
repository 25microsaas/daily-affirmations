// State Management Module
const STATE_VERSION = '1.0.0';

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
    cardStyle: 'glass',
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
    }

    // Type validators
    validators = {
        subscriptionStatus: (value) => Object.values(SUBSCRIPTION_STATUS).includes(value),
        trialEndsAt: (value) => !value || !isNaN(new Date(value).getTime()),
        customAffirmations: (value) => Array.isArray(value),
        customCollections: (value) => value && typeof value === 'object' &&
            Object.values(value).every(collection => Array.isArray(collection)),
        favorites: (value) => value && typeof value === 'object' && 
            Array.isArray(value.affirmations) && Array.isArray(value.backgrounds),
        favoritesMetadata: (value) => value && typeof value === 'object',
        weatherWidgetPosition: (value) => value && typeof value === 'object' &&
            'top' in value && 'left' in value && 'right' in value,
        statistics: (value) => value && typeof value === 'object'
    };

    // Subscribe to state changes
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // Notify all listeners
    notifyListeners() {
        this.listeners.forEach(listener => listener(this.currentSettings));
    }

    // Load state with error handling
    async loadState() {
        try {
            const result = await new Promise(resolve => {
                chrome.storage.sync.get(['settings', 'version', 'customBackgroundIds'], resolve);
            });

            let state = result.settings || defaultSettings;
            const version = result.version || '1.0.0';
            const backgroundIds = result.customBackgroundIds || [];

            // Load custom backgrounds if they exist
            if (backgroundIds.length > 0) {
                const customBackgrounds = [];
                for (const id of backgroundIds) {
                    const result = await chrome.storage.local.get(`background_${id}`);
                    if (result[`background_${id}`]) {
                        customBackgrounds.push(result[`background_${id}`]);
                    }
                }
                state.customBackgrounds = customBackgrounds;
            }

            // Validate and repair state
            state = this.validateState(state);
            this.currentSettings = state;
            this.notifyListeners();

            return state;
        } catch (error) {
            throw new StateError(
                'Failed to load state',
                'LOAD_ERROR',
                { originalError: error }
            );
        }
    }

    // Save state with validation
    async saveState(state) {
        try {
            const validatedState = this.validateState(state);
            
            // Split large data items into separate storage
            const { customBackgrounds, ...mainState } = validatedState;
            
            // Save main state
            await new Promise(resolve => {
                chrome.storage.sync.set({
                    settings: mainState,
                    version: this.version
                }, resolve);
            });

            // Save custom backgrounds separately if they exist
            if (customBackgrounds && customBackgrounds.length > 0) {
                // Save each background separately to avoid quota issues
                for (let i = 0; i < customBackgrounds.length; i++) {
                    const bg = customBackgrounds[i];
                    await chrome.storage.local.set({
                        [`background_${bg.id}`]: bg
                    });
                }
                // Save the list of background IDs
                await chrome.storage.sync.set({
                    customBackgroundIds: customBackgrounds.map(bg => bg.id)
                });
            }

            this.currentSettings = validatedState;
            this.notifyListeners();
            
            return true;
        } catch (error) {
            throw new StateError(
                'Failed to save state',
                'SAVE_ERROR',
                { originalError: error }
            );
        }
    }

    // Validate state with detailed error reporting
    validateState(state) {
        const validated = { ...defaultSettings };
        const errors = [];

        for (const [key, validator] of Object.entries(this.validators)) {
            if (key in state) {
                if (validator(state[key])) {
                    validated[key] = state[key];
                } else {
                    errors.push(`Invalid value for ${key}`);
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

    // Backup state to local storage (skip large items)
    async backupState(state) {
        try {
            const { customBackgrounds, ...backupState } = state;
            const backup = {
                state: backupState,
                timestamp: Date.now(),
                version: this.version
            };
            localStorage.setItem('settingsBackup', JSON.stringify(backup));
        } catch (error) {
            console.error('Backup creation failed:', error);
        }
    }

    // Restore from backup
    async restoreFromBackup() {
        try {
            const backup = localStorage.getItem('settingsBackup');
            if (!backup) return null;

            const { state } = JSON.parse(backup);
            return this.validateState(state);
        } catch (error) {
            throw new StateError(
                'Failed to restore from backup',
                'RESTORE_ERROR',
                { originalError: error }
            );
        }
    }

    // Update specific settings
    async updateSettings(updates) {
        try {
            const newState = {
                ...this.currentSettings,
                ...updates
            };
            await this.saveState(newState);
        } catch (error) {
            throw new StateError(
                'Failed to update settings',
                'UPDATE_ERROR',
                { originalError: error }
            );
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
}

// Create and export singleton instance
const stateManager = new StateManager();
export default stateManager;
export { SUBSCRIPTION_STATUS, StateError }; 