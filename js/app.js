
import stateManager from './modules/state.js';
import weatherService from './services/weather.js';
import backgroundService from './modules/background.js';
import affirmationsService from './services/affirmations.js';
import premiumService from './services/premium.js';
import customAffirmationsService from './services/customAffirmations.js';
import dailyReminderService from './services/dailyReminder.js';
import reminderSettings from './components/reminder-settings.js';
import { animations, makeDraggable, showNotification } from './utils/common.js';
import { setupAffirmationActions } from './actions/affirmationActions.js';
import favoriteAffirmations from './components/favoriteAffirmations.js';
import { requirePremium } from './utils/premium.js';
import favoritesManager from './components/favorites-manager.js';
import savedBackgroundsManager from './components/saved-backgrounds.js';
import backupRestoreDialog from './components/backup-restore.js';

// API Keys management
async function getApiKeys() {
    try {
        // First check if we have cached keys in chrome.storage
        const cachedKeys = await chrome.storage.local.get(['unsplashKey', 'weatherKey']);
        
        if (cachedKeys.unsplashKey && cachedKeys.weatherKey) {
            return {
                unsplash: cachedKeys.unsplashKey,
                weather: cachedKeys.weatherKey
            };
        }

        // If no cached keys, fetch from your secure backend
        const response = await fetch('https://www.daily-affirmation.today/api/get-api-keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Add any authentication tokens if needed
            // credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch API keys');
        }

        const keys = await response.json();
        
        // Cache the keys
        await chrome.storage.local.set({
            unsplashKey: keys.unsplash,
            weatherKey: keys.weather
        });

        return keys;
    } catch (error) {
        console.error('Error fetching API keys:', error);
        throw error;
    }
}

class App {
    constructor() {
        this.initialized = false;
        this.cleanup = {
            draggable: new Set(),
            animations: animations
        };
    }

    // Initialize all services
    async initializeServices() {
        const serviceStatus = {
            state: false,
            weather: false,
            background: false,
            premium: false,
            affirmations: false,
            customAffirmations: false,
            dailyReminder: false,
            backup: false
        };

        try {
            // Initialize state first as other services depend on it
            const settings = await stateManager.loadState();
            if (!settings) {
                throw new Error('Failed to load settings');
            }
            serviceStatus.state = true;

            // Apply initial settings
            this.applyInitialSettings(settings);

            // Get API keys first
            const keys = await getApiKeys();
            if (!keys) {
                throw new Error('Failed to get API keys');
            }

            // Initialize services in parallel
            await Promise.all([
                // Weather service initialization
                weatherService.init(keys.weather)
                    .then(() => serviceStatus.weather = true)
                    .catch(error => {
                        console.error('Weather service initialization failed:', error);
                        return false;
                    }),

                // Background service initialization
                backgroundService.init(keys.unsplash)
                    .then(() => serviceStatus.background = true)
                    .catch(error => {
                        console.error('Background service initialization failed:', error);
                        return false;
                    }),

                // Premium service initialization
                premiumService.initialize()
                    .then(() => serviceStatus.premium = true)
                    .catch(error => {
                        console.error('Premium service initialization failed:', error);
                        return false;
                    }),

                // Custom Affirmations service initialization
                customAffirmationsService.init()
                    .then(() => serviceStatus.customAffirmations = true)
                    .catch(error => {
                        console.error('Custom Affirmations service initialization failed:', error);
                        return false;
                    }),

                // Daily Reminder service initialization
                dailyReminderService.init()
                    .then(() => serviceStatus.dailyReminder = true)
                    .catch(error => {
                        console.error('Daily Reminder service initialization failed:', error);
                        return false;
                    }),

                // Favorite Affirmations initialization
                favoriteAffirmations.initialize()
                    .then(() => serviceStatus.favoriteAffirmations = true)
                    .catch(error => {
                        console.error('Favorite Affirmations initialization failed:', error);
                        return false;
                    }),

                // Initialize backup service
                backupRestoreDialog.initialize()
                    .then(() => serviceStatus.backup = true)
                    .catch(error => {
                        console.error('Backup service initialization failed:', error);
                        return false;
                    })
            ]);

            // Update services that successfully initialized
            const updatePromises = [];
            
            if (serviceStatus.weather) {
                updatePromises.push(
                    weatherService.update().catch(error => {
                        console.error('Weather update failed:', error);
                    })
                );
            }

            if (serviceStatus.background) {
                updatePromises.push(
                    backgroundService.update().catch(error => {
                        console.error('Background update failed:', error);
                    })
                );
            }

            // Affirmations don't require initialization
            updatePromises.push(
                affirmationsService.update().catch(error => {
                    console.error('Affirmations update failed:', error);
                })
            );

            await Promise.all(updatePromises);

            // Store service status for debugging
            this.serviceStatus = serviceStatus;

            // If any critical service failed, throw error
            if (!serviceStatus.state) {
                throw new Error('Critical service (state) failed to initialize');
            }

        } catch (error) {
            console.error('Service initialization failed:', error);
            this.handleInitializationError(error);
            throw error;
        }
    }

    // Initialize the app
    async initialize() {
        if (this.initialized) return;

        try {
            console.debug('Initializing app...');
            
            // First, ensure settings are loaded
            const settings = await stateManager.loadState();
            if (!settings) {
                throw new Error('Failed to load settings');
            }
            console.debug('Initial settings loaded:', settings);

            // Initialize services
            await this.initializeServices();
            
            // Apply initial settings before UI initialization
            this.applyInitialSettings(settings);
            
            // Initialize UI components
            await this.initializeUI();
            
            this.initialized = true;
            console.debug('App initialization complete');
        } catch (error) {
            console.error('App initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    // Apply initial settings on app load
    applyInitialSettings(settings) {
        try {
            console.debug('Applying initial settings:', settings);
            
            // Apply theme settings
            this.applyThemeSettings(settings);

            // Apply widget visibility
            const weatherWidget = document.querySelector('.weather');
            if (weatherWidget) {
                weatherWidget.style.display = settings.showWeather ? 'block' : 'none';
            }

            const timeWidget = document.querySelector('.time-widget');
            if (timeWidget) {
                timeWidget.style.display = settings.showClock ? 'block' : 'none';
            }

            // Initialize UI controls with current values
            const controls = {
                showWeather: document.getElementById('showWeather'),
                showClock: document.getElementById('showClock'),
                backgroundTheme: document.getElementById('backgroundTheme'),
                cardStyle: document.getElementById('cardStyle'),
                fontStyle: document.getElementById('fontStyle'),
                textColor: document.getElementById('textColor')
            };

            // Set control values
            if (controls.showWeather) controls.showWeather.checked = settings.showWeather;
            if (controls.showClock) controls.showClock.checked = settings.showClock;
            if (controls.backgroundTheme) controls.backgroundTheme.value = settings.backgroundTheme;
            if (controls.cardStyle) controls.cardStyle.value = settings.cardStyle;
            if (controls.fontStyle) controls.fontStyle.value = settings.fontStyle;
            if (controls.textColor) controls.textColor.value = settings.textColor;

            console.debug('Initial settings applied successfully');
        } catch (error) {
            console.error('Failed to apply initial settings:', error);
            // Continue with default settings
            const defaultSettings = stateManager.getSettings();
            console.debug('Falling back to default settings:', defaultSettings);
            this.applyThemeSettings(defaultSettings);
        }
    }

    // Initialize UI components
    async initializeUI() {
        try {
            this.initializeDraggableWidgets();
            this.initializeTimeUpdate();
            await reminderSettings.initialize();
            this.setupEventListeners();
            this.setupPanelInteractions();
            setupAffirmationActions();
        } catch (error) {
            console.error('UI initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    // Initialize draggable widgets
    initializeDraggableWidgets() {
        const widgets = document.querySelectorAll('.draggable-widget');
        
        widgets.forEach(widget => {
            const cleanup = makeDraggable(widget, {
                handle: widget.querySelector('.widget-handle'),
                onDragEnd: (e, position) => {
                    if (widget.id === 'weather-widget') {
                        stateManager.updateSettings({
                            weatherWidgetPosition: {
                                top: `${position.y}px`,
                                left: `${position.x}px`,
                                right: 'auto'
                            }
                        });
                    }
                }
            });
            
            if (cleanup) this.cleanup.draggable.add(cleanup);
        });
    }

    // Initialize time updates
    initializeTimeUpdate() {
        const updateDateTime = () => {
            const now = new Date();
            const timeElement = document.querySelector('.time');
            const dateElement = document.querySelector('.date');
            const timeWidget = document.querySelector('.time-widget');
            const settings = stateManager.getSettings();

            if (timeWidget) {
                timeWidget.style.display = settings.showClock ? 'block' : 'none';
            }

            if (settings.showClock) {
                if (timeElement) {
                    timeElement.textContent = now.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit'
                    });
                }

                if (dateElement) {
                    dateElement.textContent = now.toLocaleDateString([], {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    });
                }
            }
        };

        // Update immediately and then every second
        updateDateTime();
        this.cleanup.animations.setInterval(updateDateTime, 1000);
    }

    // Setup event listeners
    setupEventListeners() {
        // Refresh button
        document.querySelector('.refresh-button')?.addEventListener('click', () => {
            affirmationsService.update();
        });

        // Focus mode button
        document.getElementById('focusModeButton')?.addEventListener('click', () => {
            this.toggleFocusMode();
        });

        // Favorites menu item
        document.querySelector('.favorite-affirmations-item')?.addEventListener('click', async () => {
            try {
                await requirePremium('favorite_affirmations', () => {
                    favoritesManager.show();
                });
            } catch (error) {
                if (error.message === 'Premium feature not available') {
                    showNotification('Premium Required', 'Upgrade to Pro to use favorite affirmations');
                } else {
                    console.error('Failed to show favorites manager:', error);
                    showNotification('Error', 'Failed to open favorites manager');
                }
            }
        });

        // Saved backgrounds menu item
        document.querySelector('#backgroundsButton')?.addEventListener('click', async () => {
            try {
                await requirePremium('saved_backgrounds', () => {
                    savedBackgroundsManager.show();
                });
            } catch (error) {
                if (error.message === 'Premium feature not available') {
                    showNotification('Premium Required', 'Upgrade to Pro to access saved backgrounds');
                } else {
                    console.error('Failed to show saved backgrounds:', error);
                    showNotification('Error', 'Failed to show saved backgrounds');
                }
            }
        });

        // Save background button
        document.querySelector('.save-background-button')?.addEventListener('click', async () => {
            try {
                await requirePremium('saved_backgrounds', async () => {
                    await backgroundService.toggleSaveBackground();
                });
            } catch (error) {
                if (error.message === 'Premium feature not available') {
                    showNotification('Premium Required', 'Upgrade to Pro to save backgrounds');
                } else {
                    console.error('Failed to toggle background:', error);
                    showNotification('Error', error.message || 'Failed to update background');
                }
            }
        });

        // Daily Reminders menu item
        document.querySelector('.daily-reminders-item')?.addEventListener('click', async () => {
            try {
                await requirePremium('daily_reminder', () => {
                    reminderSettings.show();
                });
            } catch (error) {
                if (error.message === 'Premium feature not available') {
                    showNotification('Premium Required', 'Upgrade to Pro to use daily reminders');
                } else {
                    console.error('Failed to show reminder settings:', error);
                    showNotification('Error', 'Failed to open reminder settings');
                }
            }
        });

        // Backup & Sync menu item
        const backupMenuItem = Array.from(document.querySelectorAll('li')).find(li => {
            const icon = li.querySelector('i.material-icons-round');
            return icon && icon.textContent.trim() === 'backup';
        });
        
        if (backupMenuItem) {
            backupMenuItem.addEventListener('click', async () => {
                try {
                    await requirePremium('backup_sync', () => {
                        backupRestoreDialog.show();
                    });
                } catch (error) {
                    if (error.message === 'Premium feature not available') {
                        showNotification('Premium Required', 'Upgrade to Pro to use backup & sync');
                    } else {
                        console.error('Failed to show backup dialog:', error);
                        showNotification('Error', 'Failed to open backup dialog');
                    }
                }
            });
        }
    }

    // Setup panel interactions
    setupPanelInteractions() {
        const settingsButton = document.getElementById('settingsButton');
        const settingsPanel = document.getElementById('settingsPanel');
        const menuButton = document.getElementById('menuButton');
        const menuPanel = document.getElementById('menuPanel');

        if (!settingsButton || !settingsPanel || !menuButton || !menuPanel) {
            console.warn('Some panel elements not found');
            return;
        }

        // Settings controls
        const showWeatherCheckbox = document.getElementById('showWeather');
        const showClockCheckbox = document.getElementById('showClock');
        const backgroundThemeSelect = document.getElementById('backgroundTheme');
        const cardStyleSelect = document.getElementById('cardStyle');
        const fontStyleSelect = document.getElementById('fontStyle');
        const textColorInput = document.getElementById('textColor');
        const resetButton = document.getElementById('resetSettings');

        // Initialize settings with current values
        const settings = stateManager.getSettings();
        if (showWeatherCheckbox) showWeatherCheckbox.checked = settings.showWeather;
        if (showClockCheckbox) showClockCheckbox.checked = settings.showClock;
        if (backgroundThemeSelect) backgroundThemeSelect.value = settings.backgroundTheme;
        if (cardStyleSelect) cardStyleSelect.value = settings.cardStyle;
        if (fontStyleSelect) fontStyleSelect.value = settings.fontStyle;
        if (textColorInput) textColorInput.value = settings.textColor;

        // Apply initial styles
        this.applyThemeSettings(settings);

        // Add event listeners for settings changes
        showWeatherCheckbox?.addEventListener('change', (e) => {
            stateManager.updateSettings({ showWeather: e.target.checked });
            const weatherWidget = document.querySelector('.weather');
            if (weatherWidget) {
                weatherWidget.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        showClockCheckbox?.addEventListener('change', (e) => {
            stateManager.updateSettings({ showClock: e.target.checked });
            const timeWidget = document.querySelector('.time-widget');
            if (timeWidget) {
                timeWidget.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        // Theme settings event listeners with improved error handling
        backgroundThemeSelect?.addEventListener('change', async (e) => {
            try {
                const newTheme = e.target.value;
                await stateManager.updateSettings({ backgroundTheme: newTheme });
                
                // Clear the background cache to force new image fetch
                await chrome.storage.local.remove('background_data');
                
                // Update background with new theme
                await backgroundService.update();
                
                showNotification('Theme Updated', 'Background theme has been changed');
            } catch (error) {
                console.error('Failed to update background theme:', error);
                showNotification('Error', 'Failed to update background theme');
                // Reset select to current value
                e.target.value = stateManager.getSettings().backgroundTheme;
            }
        });

        cardStyleSelect?.addEventListener('change', async (e) => {
            try {
                const newStyle = e.target.value;
                await stateManager.updateSettings({ cardStyle: newStyle });
                this.updateCardStyles(newStyle);
                showNotification('Style Updated', 'Card style has been changed');
            } catch (error) {
                console.error('Failed to update card style:', error);
                showNotification('Error', 'Failed to update card style');
                // Reset select to current value
                e.target.value = stateManager.getSettings().cardStyle;
            }
        });

        fontStyleSelect?.addEventListener('change', async (e) => {
            try {
                const newFont = e.target.value;
                await stateManager.updateSettings({ fontStyle: newFont });
                document.body.className = document.body.className
                    .split(' ')
                    .filter(cls => !cls.startsWith('font-'))
                    .join(' ');
                document.body.classList.add(`font-${newFont}`, 'font-fallback');
                showNotification('Font Updated', 'Font style has been changed');
            } catch (error) {
                console.error('Failed to update font style:', error);
                showNotification('Error', 'Failed to update font style');
                // Reset select to current value
                e.target.value = stateManager.getSettings().fontStyle;
            }
        });

        textColorInput?.addEventListener('change', async (e) => {
            try {
                const newColor = e.target.value;
                if (!/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
                    throw new Error('Invalid color format');
                }
                await stateManager.updateSettings({ textColor: newColor });
                document.documentElement.style.setProperty('--color-text-primary', newColor);
                document.documentElement.style.setProperty('--color-text-secondary', this.adjustColorOpacity(newColor, 0.7));
                showNotification('Color Updated', 'Text color has been changed');
            } catch (error) {
                console.error('Failed to update text color:', error);
                showNotification('Error', 'Failed to update text color');
                // Reset input to current value
                e.target.value = stateManager.getSettings().textColor;
            }
        });

        // Reset settings button
        resetButton?.addEventListener('click', async () => {
            try {
                // Show loading state
                resetButton.disabled = true;
                resetButton.textContent = 'Resetting...';

                // Reset settings in the background
                await stateManager.resetToDefaults();

                // Reload the page to apply all default settings
                window.location.reload();
            } catch (error) {
                console.error('Failed to reset settings:', error);
                // Show error state
                resetButton.textContent = 'Reset Failed';
                setTimeout(() => {
                    resetButton.disabled = false;
                    resetButton.textContent = 'Reset Settings';
                }, 2000);
            }
        });

        // Settings panel toggle
        settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanel.classList.toggle('hidden');
            menuPanel.classList.add('hidden');
        });

        // Menu panel toggle
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            menuPanel.classList.toggle('hidden');
            settingsPanel.classList.add('hidden');
        });

        // Close panels when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && !settingsButton.contains(e.target)) {
                settingsPanel.classList.add('hidden');
            }
            if (!menuPanel.contains(e.target) && !menuButton.contains(e.target)) {
                menuPanel.classList.add('hidden');
            }
        });
    }

    // Apply theme settings with validation
    applyThemeSettings(settings) {
        try {
            // Validate settings
            if (!settings) {
                throw new Error('Invalid settings object');
            }

            // Apply card style
            if (settings.cardStyle && ['glass', 'solid', 'minimal'].includes(settings.cardStyle)) {
                this.updateCardStyles(settings.cardStyle);
            }

            // Apply font style
            if (settings.fontStyle && ['default', 'serif', 'monospace'].includes(settings.fontStyle)) {
                document.body.className = document.body.className
                    .split(' ')
                    .filter(cls => !cls.startsWith('font-'))
                    .join(' ');
                document.body.classList.add(`font-${settings.fontStyle}`, 'font-fallback');
            }

            // Apply text color
            if (settings.textColor && /^#[0-9A-Fa-f]{6}$/.test(settings.textColor)) {
                document.documentElement.style.setProperty('--color-text-primary', settings.textColor);
                document.documentElement.style.setProperty('--color-text-secondary', this.adjustColorOpacity(settings.textColor, 0.7));
            }

        } catch (error) {
            console.error('Failed to apply theme settings:', error);
            // Fallback to default settings
            this.applyThemeSettings(stateManager.getSettings());
        }
    }

    // Update card styles with cleanup
    updateCardStyles(style) {
        try {
            if (!['glass', 'solid', 'minimal'].includes(style)) {
                throw new Error('Invalid card style');
            }

            const widgets = document.querySelectorAll('.weather, .time-widget, .affirmation-card, .settings-button, .menu-button, .photo-credit, .focus-mode-button, .settings-panel, .menu-panel');
            widgets.forEach(widget => {
                widget.classList.remove('glass', 'solid', 'minimal');
                widget.classList.add(style);
            });

            // Clean up any existing observer
            if (this.cardStyleObserver) {
                this.cardStyleObserver.disconnect();
            }

            // Setup new observer
            this.cardStyleObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.classList &&
                            (node.classList.contains('glass') ||
                            node.classList.contains('solid') ||
                            node.classList.contains('minimal'))) {
                            node.classList.remove('glass', 'solid', 'minimal');
                            node.classList.add(style);
                        }
                    });
                });
            });

            this.cardStyleObserver.observe(document.body, { childList: true, subtree: true });
        } catch (error) {
            console.error('Failed to update card styles:', error);
            // Fallback to default style
            this.updateCardStyles('glass');
        }
    }

    // Adjust color opacity
    adjustColorOpacity(color, opacity) {
        const r = parseInt(color.substr(1,2), 16);
        const g = parseInt(color.substr(3,2), 16);
        const b = parseInt(color.substr(5,2), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // Toggle focus mode
    async toggleFocusMode() {
        const body = document.body;
        const focusModeClass = 'focus-mode';
        const elements = document.querySelectorAll('.weather, .time-widget, .settings-button, .menu-button, .photo-credit');
        
        const toggleElements = (show) => {
            elements.forEach(el => {
                el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                el.style.opacity = show ? '1' : '0';
                el.style.transform = show ? 'none' : 'scale(0.9)';
                el.style.pointerEvents = show ? 'auto' : 'none';
            });
        };

        const isFocusModeActive = body.classList.contains(focusModeClass);
        
        if (isFocusModeActive) {
            // Exit focus mode
            body.classList.remove(focusModeClass);
            toggleElements(true);
            document.getElementById('background-overlay').style.filter = 'brightness(0.85) saturate(1.1)';
        } else {
            // Enter focus mode
            body.classList.add(focusModeClass);
            toggleElements(false);
            document.getElementById('background-overlay').style.filter = 'brightness(0.6) saturate(1.2) blur(3px)';
        }

        // Save state
        await stateManager.updateSettings({
            focusMode: !isFocusModeActive
        });
    }

    // Handle initialization errors
    handleInitializationError(error) {
        console.error('Failed to initialize the application:', error);
        
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-container glass';
        errorContainer.innerHTML = `
            <div class="error-content">
                <h2>Something went wrong</h2>
                <p>We couldn't initialize some features. Please try refreshing the page.</p>
                <button onclick="window.location.reload()">Refresh Page</button>
            </div>
        `;
        
        document.body.appendChild(errorContainer);
    }

    // Cleanup resources
    cleanup() {
        // Clean up draggable widgets
        if (this.cleanup && this.cleanup.draggable) {
            this.cleanup.draggable.forEach(cleanup => cleanup());
            this.cleanup.draggable.clear();
        }

        // Clean up animations
        if (this.cleanup && this.cleanup.animations) {
            this.cleanup.animations.clearAll();
        }

        // Clean up daily reminder service
        dailyReminderService.cleanup();

        // Clean up card style observer
        if (this.cardStyleObserver) {
            this.cardStyleObserver.disconnect();
            this.cardStyleObserver = null;
        }
    }
}

// Create and initialize app when DOM is loaded
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.initialize());

// Cleanup before page unload
window.addEventListener('beforeunload', () => {
    if (app && typeof app.cleanup === 'function') {
        app.cleanup();
    }
});

// Export for debugging
window.app = app;