// Theme Service Module
import stateManager from '../modules/state.js';
import { requirePremium } from '../utils/premium.js';

class ThemeError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'ThemeError';
        this.code = code;
        this.details = details;
    }
}

class ThemeService {
    constructor() {
        this.defaultThemes = [
            {
                id: 'default',
                name: 'Default',
                colors: {
                    primary: '#22c55e',
                    secondary: '#16a34a',
                    background: '#000000',
                    text: '#ffffff',
                    textSecondary: 'rgba(255, 255, 255, 0.7)'
                },
                fonts: {
                    primary: 'Roboto, system-ui, sans-serif',
                    secondary: 'Roboto, system-ui, sans-serif'
                },
                glassMorphism: {
                    background: 'rgba(0, 0, 0, 0.2)',
                    blur: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }
            },
            {
                id: 'light',
                name: 'Light',
                colors: {
                    primary: '#16a34a',
                    secondary: '#22c55e',
                    background: '#ffffff',
                    text: '#1a1a1a',
                    textSecondary: 'rgba(26, 26, 26, 0.7)'
                },
                fonts: {
                    primary: 'Roboto, system-ui, sans-serif',
                    secondary: 'Roboto, system-ui, sans-serif'
                },
                glassMorphism: {
                    background: 'rgba(255, 255, 255, 0.2)',
                    blur: '16px',
                    border: '1px solid rgba(26, 26, 26, 0.1)'
                }
            }
        ];
        this.init();
    }

    async init() {
        try {
            const theme = this.getCurrentTheme();
            await this.applyTheme(theme);
        } catch (error) {
            console.error('Failed to initialize theme:', error);
            // Fallback to default theme
            await this.applyTheme(this.defaultThemes[0]);
        }
    }

    // Get current theme with validation
    getCurrentTheme() {
        try {
            const settings = stateManager.getSettings();
            const theme = settings.theme;
            
            // Validate theme structure
            if (!theme || !this.isValidTheme(theme)) {
                console.warn('Invalid theme detected, falling back to default');
                return this.defaultThemes[0];
            }
            
            return theme;
        } catch (error) {
            console.error('Error getting current theme:', error);
            return this.defaultThemes[0];
        }
    }

    // Validate theme object structure
    isValidTheme(theme) {
        return theme &&
            typeof theme === 'object' &&
            theme.id &&
            theme.colors &&
            typeof theme.colors === 'object' &&
            theme.fonts &&
            typeof theme.fonts === 'object' &&
            theme.glassMorphism &&
            typeof theme.glassMorphism === 'object';
    }

    // Apply theme to document with error handling
    async applyTheme(theme = this.getCurrentTheme()) {
        try {
            const root = document.documentElement;
            const { colors, fonts, glassMorphism } = theme;

            // Validate required theme properties
            if (!colors || !fonts || !glassMorphism) {
                throw new Error('Invalid theme structure');
            }

            // Apply colors with validation
            Object.entries(colors).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                    root.style.setProperty(`--color-${key}`, value);
                }
            });

            // Apply fonts with validation
            Object.entries(fonts).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                    root.style.setProperty(`--font-${key}`, value);
                }
            });

            // Apply glass morphism with validation
            Object.entries(glassMorphism).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                    root.style.setProperty(`--glass-${key}`, value);
                }
            });

            // Apply theme class safely
            document.body.className = document.body.className
                .split(' ')
                .filter(cls => !cls.startsWith('theme-'))
                .join(' ');
            document.body.classList.add(`theme-${theme.id}`);

            // Save theme to storage
            await this.persistTheme(theme);

        } catch (error) {
            console.error('Failed to apply theme:', error);
            // Fallback to default theme
            if (theme !== this.defaultThemes[0]) {
                await this.applyTheme(this.defaultThemes[0]);
            }
            throw new ThemeError('Failed to apply theme', 'APPLY_THEME_ERROR', { originalError: error });
        }
    }

    // Safely persist theme to storage
    async persistTheme(theme) {
        try {
            await stateManager.updateSettings({ theme });
        } catch (error) {
            console.error('Failed to persist theme:', error);
            throw new ThemeError('Failed to save theme', 'SAVE_THEME_ERROR', { originalError: error });
        }
    }

    // Update theme settings with validation
    async updateTheme(themeSettings) {
        try {
            return await requirePremium('theme_settings', async () => {
                const currentTheme = this.getCurrentTheme();
                
                // Validate new theme settings
                const newTheme = {
                    ...currentTheme,
                    ...themeSettings,
                    id: 'custom',
                    name: 'Custom'
                };

                if (!this.isValidTheme(newTheme)) {
                    throw new Error('Invalid theme settings');
                }

                await this.applyTheme(newTheme);
                return newTheme;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new ThemeError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new ThemeError(
                'Failed to update theme',
                'UPDATE_THEME_ERROR',
                { originalError: error }
            );
        }
    }

    // Reset theme to default
    async resetTheme() {
        try {
            const defaultTheme = this.defaultThemes[0];
            await stateManager.updateSettings({ theme: defaultTheme });
            this.applyTheme(defaultTheme);
            return defaultTheme;
        } catch (error) {
            throw new ThemeError(
                'Failed to reset theme',
                'RESET_THEME_ERROR',
                { originalError: error }
            );
        }
    }

    // Get available fonts
    getAvailableFonts() {
        return [
            'Inter',
            'Roboto',
            'Open Sans',
            'Lato',
            'Montserrat',
            'Source Sans Pro',
            'Nunito',
            'Raleway',
            'Poppins',
            'Ubuntu'
        ].map(font => ({
            name: font,
            value: `${font}, system-ui, sans-serif`
        }));
    }
}

// Create and export singleton instance
const themeService = new ThemeService();
export default themeService;
export { ThemeError }; 