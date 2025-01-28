// Background Service Module
import stateManager from '../modules/state.js';
import { requirePremium } from '../utils/premium.js';
import { showNotification } from '../utils/common.js';
import { authService } from './auth.js';
import { initializeConfig } from '../config.js';

class BackgroundError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'BackgroundError';
        this.code = code;
        this.details = details;
    }
}

class BackgroundService {
    constructor() {
        this.CACHE_KEY = 'background_data';
        this.CACHE_DURATION = 3600000; // 1 hour
        this.API_KEY = null;
        this.themes = {
            nature: 'nature,landscape,peaceful',
            minimal: 'minimal,simple,clean',
            architecture: 'architecture,building,modern',
            abstract: 'abstract,texture,pattern'
        };

        // Default backgrounds for offline mode
        this.defaultBackgrounds = [
            {
                id: 'default_1',
                url: '../images/backgrounds/default-1.jpeg',
                credit: 'Default Background 1'
            },
            {
                id: 'default_2',
                url: '../images/backgrounds/default-2.jpeg',
                credit: 'Default Background 2'
            },
            {
                id: 'default_3',
                url: '../images/backgrounds/default-3.jpeg',
                credit: 'Default Background 3'
            },
            {
                id: 'default_4',
                url: '../images/backgrounds/default-4.jpeg',
                credit: 'Default Background 4'
            },
            {
                id: 'default_5',
                url: '../images/backgrounds/default-5.jpeg',
                credit: 'Default Background 5'
            }
        ];

        this.cachedBackgrounds = new Map();
        this.offlineMode = !navigator.onLine;
        this.currentBackground = null;
        this.initialized = false;

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.offlineMode = false;
            if (!this.isFixedBackground()) {
                this.refreshBackground();
            }
        });

        window.addEventListener('offline', () => {
            this.offlineMode = true;
            this.useOfflineBackground();
        });

        // Set up notification click handler
        chrome.notifications.onClicked.addListener(this.handleNotificationClick.bind(this));
        chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));

        // Initialize action click handler if available
        if (chrome.action && chrome.action.onClicked) {
            chrome.action.onClicked.addListener(() => {
                this.handleActionClick();
            });
        }

        // Register service worker
        this.registerServiceWorker();
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/js/background-worker.js');
                console.log('ServiceWorker registered:', registration);

                // Send API key to service worker when it's active
                if (registration.active && this.API_KEY) {
                    registration.active.postMessage({
                        type: 'INIT',
                        apiKey: this.API_KEY
                    });
                }
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        }
    }

    async handleActionClick() {
        // Handle extension icon click
        chrome.tabs.create({ url: 'newtab.html' });
    }

    // Initialize API key
    async init(apiKey) {
        if (!apiKey) {
            throw new BackgroundError('API key is required', 'API_KEY_MISSING');
        }

        this.API_KEY = apiKey;
        await this.loadCachedData();
        this.initialized = true;
        return true;
    }

    // Get background query based on theme
    getBackgroundQuery() {
        const settings = stateManager.getSettings();
        const theme = settings.backgroundTheme || 'nature';
        const query = this.themes[theme] || this.themes.nature;
        return encodeURIComponent(query);
    }

    // Fetch background from Unsplash
    async fetchBackground() {
        try {
            if (!this.API_KEY) {
                throw new BackgroundError('API key not initialized', 'API_KEY_MISSING');
            }

            const query = this.getBackgroundQuery();
            const endpoint = `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&content_filter=high`;

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Client-ID ${this.API_KEY}`,
                    'Accept': 'application/json',
                    'Sec-Fetch-Site': 'cross-site',
                    'Sec-Fetch-Mode': 'cors'
                },
                credentials: 'same-origin', // Don't send cookies for cross-origin requests
                mode: 'cors'
            });

            if (!response.ok) {
                throw new BackgroundError(
                    'Unsplash API error',
                    'API_ERROR',
                    { status: response.status }
                );
            }

            const data = await response.json();

            // Process image URL to avoid cookie issues
            const imageUrl = new URL(data.urls.regular);
            imageUrl.searchParams.set('w', '1920');
            imageUrl.searchParams.set('auto', 'format');
            imageUrl.searchParams.set('fit', 'max');
            imageUrl.searchParams.set('q', '80');

            // Cache the processed data
            await this.cacheData({
                ...data,
                urls: {
                    ...data.urls,
                    regular: imageUrl.toString()
                },
                theme: stateManager.getSettings().backgroundTheme
            });

            return data;
        } catch (error) {
            if (error instanceof BackgroundError) throw error;
            throw new BackgroundError(
                'Failed to fetch background',
                'FETCH_ERROR',
                { originalError: error }
            );
        }
    }

    // Cache background data
    async cacheData(data) {
        try {
            const cache = {
                data,
                timestamp: Date.now(),
                expiresAt: Date.now() + this.CACHE_DURATION,
                theme: data.theme || stateManager.getSettings().backgroundTheme
            };
            await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
        } catch (error) {
            console.error('Failed to cache background data:', error);
        }
    }

    // Load cached data
    async loadCachedData() {
        try {
            const result = await chrome.storage.local.get(this.CACHE_KEY);
            const cache = result[this.CACHE_KEY];
            const currentTheme = stateManager.getSettings().backgroundTheme;

            // Return cache only if it's valid and matches current theme
            if (cache &&
                cache.expiresAt > Date.now() &&
                cache.theme === currentTheme) {
                return cache.data;
            }
            return null;
        } catch (error) {
            console.error('Failed to load cached background data:', error);
            return null;
        }
    }

    // Preload image with no-cookie settings
    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.referrerPolicy = 'no-referrer';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new BackgroundError('Failed to load image', 'IMAGE_LOAD_ERROR'));
            img.src = url;
        });
    }

    // Update background display
    async updateDisplay(data) {
        const overlay = document.getElementById('background-overlay');
        const creditLink = document.getElementById('photo-credit-link');
        const locationElement = document.getElementById('photo-location');

        if (!overlay || !creditLink || !locationElement) {
            throw new BackgroundError('Required elements not found', 'ELEMENTS_MISSING');
        }

        try {
            // Construct URL with no-cookie parameter and optimization settings
            const imageUrl = new URL(data.urls.regular);
            imageUrl.searchParams.set('w', '1920');
            imageUrl.searchParams.set('auto', 'format');
            imageUrl.searchParams.set('no_cookie', '1');

            // Preload image before displaying
            await this.preloadImage(imageUrl.toString());

            overlay.style.backgroundImage = `url(${imageUrl.toString()})`;
            creditLink.href = `${data.user.links.html}?utm_source=daily_affirmations&utm_medium=referral`;
            creditLink.textContent = data.user.name;

            const location = data.location?.name || data.location?.city || data.location?.country;
            locationElement.textContent = location ? `📍 ${location}` : '';

            // Save current background in settings
            await stateManager.updateSettings({
                currentBackground: {
                    id: data.id,
                    url: imageUrl.toString(),
                    credit: `Photo by ${data.user.name} on Unsplash`,
                    location: location || null,
                    addedAt: new Date().toISOString()
                }
            });

            // Update save button state
            await this.updateSaveButtonState();

        } catch (error) {
            console.error('Failed to update background display:', error);
            this.handleError();
        }
    }

    // Handle background errors
    handleError() {
        const overlay = document.getElementById('background-overlay');
        if (overlay) {
            overlay.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
            overlay.style.backgroundSize = 'cover';
        }
    }

    // Add custom background (premium feature)
    async addCustomBackground(imageUrl) {
        try {
            return await requirePremium('custom_backgrounds', async () => {
                // Validate image URL and size
                const img = await this.preloadImage(imageUrl);

                // Check image dimensions
                if (img.width < 800 || img.height < 600) {
                    throw new Error('Image resolution too low. Minimum 800x600 required.');
                }

                // Check if it's a valid image format
                if (!imageUrl.match(/^data:image\/(jpeg|jpg|png|webp)/i)) {
                    throw new Error('Invalid image format. Use JPEG, PNG or WebP.');
                }

                // Optimize image size by creating a canvas and reducing quality
                const canvas = document.createElement('canvas');
                const maxWidth = 1280; // Reduced from 1920 for better storage
                const maxHeight = 720; // Reduced from 1080 for better storage
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG with reduced quality
                const optimizedImageUrl = canvas.toDataURL('image/jpeg', 0.7); // Reduced quality from 0.8 to 0.7

                const customBackground = {
                    id: 'custom_' + Date.now(),
                    url: optimizedImageUrl,
                    credit: 'Custom Background',
                    createdAt: new Date().toISOString()
                };

                // Save directly to chrome.storage.local
                await chrome.storage.local.set({
                    [`background_${customBackground.id}`]: customBackground
                });

                // Update the list of background IDs in sync storage
                const settings = stateManager.getSettings();
                const customBackgrounds = settings.customBackgrounds || [];
                const updatedBackgrounds = [...customBackgrounds, customBackground];

                await stateManager.updateSettings({
                    customBackgrounds: updatedBackgrounds
                });

                // Set as current background
                await this.updateBackgroundDisplay(customBackground);

                return customBackground;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new BackgroundError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new BackgroundError(
                error.message || 'Failed to add custom background',
                'ADD_CUSTOM_ERROR',
                { originalError: error }
            );
        }
    }

    // Main update function
    async update() {
        try {
            // Try to load cached data first
            const cached = await this.loadCachedData();
            if (cached) {
                await this.updateDisplay(cached);
                return;
            }

            // Get fresh data
            const data = await this.fetchBackground();
            await this.updateDisplay(data);

        } catch (error) {
            console.error('Background update failed:', error);
            this.handleError();
        }
    }

    // Load and cache image
    async loadImage(url) {
        try {
            // Try loading online image first
            const img = new Image();
            const loadPromise = new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = () => reject(new BackgroundError('Failed to load image'));
            });

            img.src = url;

            try {
                return await loadPromise;
            } catch (error) {
                // If online image fails, try loading fallback
                console.log('Failed to load online image, trying fallback...');
                const fallbackImages = [
                    'images/backgrounds/default-1.jpeg',
                    'images/backgrounds/default-2.jpeg',
                    'images/backgrounds/default-3.jpeg',
                    'images/backgrounds/default-4.jpeg',
                    'images/backgrounds/default-5.jpeg'
                ];

                const fallbackImg = new Image();
                const fallbackPromise = new Promise((resolve, reject) => {
                    fallbackImg.onload = () => resolve(fallbackImg);
                    fallbackImg.onerror = () => reject(new BackgroundError('Failed to load fallback image'));
                });

                const randomFallback = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
                fallbackImg.src = chrome.runtime.getURL(randomFallback);

                return await fallbackPromise;
            }
        } catch (error) {
            throw new BackgroundError('Failed to load any image');
        }
    }

    // Get random background from Unsplash
    async getRandomBackground() {
        if (this.offlineMode) {
            return this.getOfflineBackground();
        }

        try {
            if (!this.API_KEY) {
                console.warn('No API key available, using offline background');
                return this.getOfflineBackground();
            }

            const query = this.getBackgroundQuery();
            const endpoint = `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&content_filter=high`;

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Client-ID ${this.API_KEY}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new BackgroundError(
                    'Failed to fetch from Unsplash',
                    'API_ERROR',
                    { status: response.status }
                );
            }

            const data = await response.json();

            return {
                id: data.id,
                url: data.urls.regular,
                thumbnail: data.urls.thumb,
                credit: `Photo by ${data.user.name} on Unsplash`,
                location: data.location?.name || data.location?.city || data.location?.country || null
            };
        } catch (error) {
            console.warn('Failed to fetch online background:', error);
            return this.getOfflineBackground();
        }
    }

    // Get offline background
    getOfflineBackground() {
        const settings = stateManager.getSettings();
        const lastBackground = settings.lastBackground;

        // Try to use last used background if available
        if (lastBackground && this.cachedBackgrounds.has(lastBackground.url)) {
            return lastBackground;
        }

        // Fallback to default backgrounds
        const randomIndex = Math.floor(
            Math.random() * this.defaultBackgrounds.length
        );
        return this.defaultBackgrounds[randomIndex];
    }

    // Check if we're in fixed background mode
    isFixedBackground() {
        const settings = stateManager.getSettings();
        return settings.backgroundMode === 'fixed' && settings.currentBackground;
    }

    // Set background mode
    async setBackgroundMode(mode, background = null) {
        await stateManager.updateSettings({
            backgroundMode: mode,
            currentBackground: background
        });
    }

    // Update background display with mode handling
    async updateBackgroundDisplay(background, setAsFixed = true) {
        try {
            const overlay = document.getElementById('background-overlay');
            const creditLink = document.getElementById('photo-credit-link');
            const locationElement = document.getElementById('photo-location');

            if (!overlay || !creditLink || !locationElement) {
                throw new BackgroundError('Required elements not found', 'ELEMENTS_MISSING');
            }

            // Load and validate the image first
            await this.preloadImage(background.url);

            // Update the background image
            overlay.style.backgroundImage = `url(${background.url})`;

            // Update credit information
            if (background.credit) {
                creditLink.textContent = background.credit.replace('Photo by ', '').replace(' on Unsplash', '');
                creditLink.href = background.credit.includes('Unsplash')
                    ? `https://unsplash.com/@${creditLink.textContent.toLowerCase().replace(' ', '')}?utm_source=daily_affirmations&utm_medium=referral`
                    : '#';
            } else {
                creditLink.textContent = 'Unknown';
                creditLink.href = '#';
            }

            // Update location if available
            locationElement.textContent = background.location ? `📍 ${background.location}` : '';

            // Save as current background in settings with mode
            await stateManager.updateSettings({
                currentBackground: setAsFixed ? {
                    ...background,
                    addedAt: background.addedAt || new Date().toISOString()
                } : null,
                backgroundMode: setAsFixed ? 'fixed' : 'random'
            });

            // Update save button state
            await this.updateSaveButtonState();

            return background;
        } catch (error) {
            console.error('Failed to update background display:', error);
            showNotification('Error', 'Failed to update background');

            // Try offline background if online one fails
            if (!this.offlineMode) {
                this.offlineMode = true;
                return this.useOfflineBackground();
            }

            throw new BackgroundError(
                'Failed to update background',
                'UPDATE_ERROR',
                { originalError: error }
            );
        }
    }

    // Use offline background
    async useOfflineBackground() {
        const background = this.getOfflineBackground();
        return this.updateBackgroundDisplay(background);
    }

    // Refresh background
    async refreshBackground() {
        const settings = stateManager.getSettings();
        if (settings.currentBackground && settings.backgroundMode === 'fixed') {
            // If we have a current background and we're in fixed mode, use it
            return this.updateBackgroundDisplay(settings.currentBackground, true);
        } else {
            // Otherwise get a new random background
            const background = await this.getRandomBackground();
            return this.updateBackgroundDisplay(background, false);
        }
    }

    // Initialize background service with mode handling
    async initialize() {
        try {
            // Check if offline
            this.offlineMode = !navigator.onLine;

            // Preload default backgrounds
            await Promise.all(
                this.defaultBackgrounds.map(bg => this.loadImage(bg.url))
            );

            // Check settings for fixed background
            const settings = stateManager.getSettings();

            if (settings.backgroundMode === 'fixed' && settings.currentBackground) {
                // If in fixed mode and has current background, restore it
                await this.updateBackgroundDisplay(settings.currentBackground, true);
            } else if (settings.backgroundMode === 'random') {
                // If in random mode, get a new random background
                await this.refreshBackground();
            } else {
                // Default to random mode if no mode is set
                await this.setBackgroundMode('random');
                await this.refreshBackground();
            }
        } catch (error) {
            console.error('Failed to initialize background service:', error);
            // Fallback to first default background in fixed mode
            await this.updateBackgroundDisplay(this.defaultBackgrounds[0], true);
        }
    }

    async isBackgroundSaved(backgroundId) {
        const settings = stateManager.getSettings();
        const customBackgrounds = settings.customBackgrounds || [];
        return customBackgrounds.some(bg => bg.id === backgroundId);
    }

    async updateSaveButtonState() {
        const saveButton = document.querySelector('.save-background-button');
        if (!saveButton) return;

        const settings = stateManager.getSettings();
        const currentBackground = settings.currentBackground;

        if (!currentBackground) {
            saveButton.disabled = false;
            saveButton.title = 'No background to save';
            return;
        }

        const isSaved = await this.isBackgroundSaved(currentBackground.id);
        saveButton.title = isSaved ? 'Remove from saved backgrounds' : 'Save this background';
        saveButton.classList.toggle('saved', isSaved);
        // Don't disable the button, allow clicking to toggle
        saveButton.disabled = false;
    }

    async toggleSaveBackground() {
        try {
            const settings = stateManager.getSettings();
            const currentBackground = settings.currentBackground;

            if (!currentBackground) {
                throw new Error('No background to save');
            }

            const isSaved = await this.isBackgroundSaved(currentBackground.id);
            const customBackgrounds = settings.customBackgrounds || [];

            if (isSaved) {
                // Remove from saved backgrounds
                const updatedBackgrounds = customBackgrounds.filter(bg => bg.id !== currentBackground.id);
                await stateManager.updateSettings({ customBackgrounds: updatedBackgrounds });
                showNotification('Removed', 'Background removed from your collection');
            } else {
                // Add to saved backgrounds
                customBackgrounds.push({
                    ...currentBackground,
                    savedAt: new Date().toISOString()
                });
                await stateManager.updateSettings({ customBackgrounds });
                showNotification('Saved', 'Background added to your collection');
            }

            await this.updateSaveButtonState();
        } catch (error) {
            console.error('Failed to toggle background save state:', error);
            showNotification('Error', error.message || 'Failed to update background');
        }
    }

    // Unset current background and return to random mode
    async unsetCurrentBackground() {
        await stateManager.updateSettings({
            currentBackground: null,
            backgroundMode: 'random'
        });
        await this.refreshBackground();
        showNotification('Success', 'Returned to random backgrounds mode');
    }

    // Handle notification clicks
    handleNotificationClick(notificationId) {
        if (notificationId === 'daily_reminder') {
            chrome.tabs.query({ url: chrome.runtime.getURL('newtab.html') }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.update(tabs[0].id, { active: true });
                } else {
                    chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') });
                }
                chrome.notifications.clear(notificationId);
            });
        }
    }

    // Handle alarms for reminders
    async handleAlarm(alarm) {
        if (alarm.name.startsWith('reminder_')) {

            try {
                const settings = stateManager.getSettings();
                const reminder = settings.dailyReminder;

                // Check if reminders are enabled and properly configured
                if (!reminder) {
                    return;
                }

                if (!reminder.enabled) {
                    return;
                }

                // Check if today is a reminder day
                const now = new Date();
                const userTimezone = reminder.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
                const currentDay = now.toLocaleDateString('en-US', {
                    weekday: 'short',
                    timeZone: userTimezone
                }).toLowerCase();


                if (!reminder.days?.includes(currentDay)) {
                    return;
                }

                // Check if we've already notified today
                const lastNotified = reminder.lastNotified
                    ? new Date(reminder.lastNotified)
                    : new Date(0);

                // Ignore lastNotified if it's in the future
                if (lastNotified > now) {
                    reminder.lastNotified = null;
                }

                const lastNotifiedDay = reminder.lastNotified
                    ? new Date(reminder.lastNotified).toLocaleDateString('en-US', { timeZone: userTimezone })
                    : null;
                const todayInUserTz = now.toLocaleDateString('en-US', { timeZone: userTimezone });

                if (lastNotifiedDay && lastNotifiedDay === todayInUserTz) {
                    return;
                }


                // Show notification
                await this.showReminderNotification(reminder.message);

                // Update last notified time
                await stateManager.updateSettings({
                    dailyReminder: {
                        ...reminder,
                        lastNotified: now.toISOString()
                    }
                });

            } catch (error) {
                console.error('Failed to handle reminder alarm:', error);
            }
        }
    }

    // Show reminder notification
    async showReminderNotification(message) {
        try {
            await chrome.notifications.create('daily_reminder', {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('images/icon-128.png'),
                title: 'Daily Affirmation',
                message: message || 'Time for your daily affirmation!',
                requireInteraction: true,
                silent: false,
                priority: 2
            });
        } catch (error) {
            console.error('Failed to show reminder notification:', error);
        }
    }
}

// Create and export singleton instance
const backgroundService = new BackgroundService();
export default backgroundService;
export { BackgroundError }; 