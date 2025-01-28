// Extension key will be set during initialization
let EXTENSION_KEY = null;
const API_BASE_URL = 'https://daily-affirmation.today/api';

class AuthService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async initialize() {
        try {
            // Try to get the extension key from storage
            const result = await chrome.storage.local.get(['extension_key']);
            EXTENSION_KEY = result.extension_key;

            // Try to get existing token from storage
            const stored = await chrome.storage.local.get(['accessToken', 'tokenExpiry']);
            if (stored.accessToken && stored.tokenExpiry && new Date(stored.tokenExpiry) > new Date()) {
                this.accessToken = stored.accessToken;
                this.tokenExpiry = stored.tokenExpiry;
                return;
            }

            // If no valid token, authenticate
            if (EXTENSION_KEY) {
                await this.authenticate();
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
        }
    }

    async setExtensionKey(key) {
        EXTENSION_KEY = key;
        await chrome.storage.local.set({ extension_key: key });
    }

    async authenticate() {
        try {
            if (!EXTENSION_KEY) {
                throw new Error('Extension key not configured');
            }

            const response = await fetch(`${API_BASE_URL}/auth/extension`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Extension-Id': chrome.runtime.id,
                    'X-Extension-Key': EXTENSION_KEY
                }
            });

            if (!response.ok) {
                throw new Error('Authentication failed');
            }

            const data = await response.json();
            this.accessToken = data.accessToken;
            this.tokenExpiry = new Date(Date.now() + (data.expiresIn * 1000));

            // Store in chrome.storage
            await chrome.storage.local.set({
                accessToken: this.accessToken,
                tokenExpiry: this.tokenExpiry.toISOString()
            });
        } catch (error) {
            console.error('Auth error:', error);
            throw error;
        }
    }

    async getAccessToken() {
        if (!this.accessToken || new Date(this.tokenExpiry) <= new Date()) {
            await this.authenticate();
        }
        return this.accessToken;
    }

    async makeAuthenticatedRequest(endpoint, options = {}) {
        const token = await this.getAccessToken();
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        return fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
    }
}

export const authService = new AuthService(); 