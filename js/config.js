import { authService } from './services/auth.js';

// This will be replaced during build with actual key
const DEFAULT_EXTENSION_KEY = '__EXTENSION_KEY__';

// Initialize extension configuration
export async function initializeConfig() {
    try {
        // Set up extension key if not already configured
        const { extension_key } = await chrome.storage.local.get(['extension_key']);
        if (!extension_key && DEFAULT_EXTENSION_KEY !== '__EXTENSION_KEY__') {
            await authService.setExtensionKey(DEFAULT_EXTENSION_KEY);
        }
    } catch (error) {
        console.error('Failed to initialize extension config:', error);
    }
} 