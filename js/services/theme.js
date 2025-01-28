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
    }

    // Get current theme
    getCurrentTheme() {
        const settings = stateManager.getSettings();
        return settings.theme || this.defaultThemes[0];
    }

    // Apply theme to document
    applyTheme(theme = this.getCurrentTheme()) {
        const root = document.documentElement;
        const { colors, fonts, glassMorphism } = theme;

        // Apply colors
        Object.entries(colors).forEach(([key, value]) => {
            root.style.setProperty(`--color-${key}`, value);
        });

        // Apply fonts
        Object.entries(fonts).forEach(([key, value]) => {
            root.style.setProperty(`--font-${key}`, value);
        });

        // Apply glass morphism
        Object.entries(glassMorphism).forEach(([key, value]) => {
            root.style.setProperty(`--glass-${key}`, value);
        });

        // Apply theme class
        document.body.className = document.body.className
            .replace(/theme-\w+/, '')
            .trim();
        document.body.classList.add(`theme-${theme.id}`);
    }

    // Update theme settings
    async updateTheme(themeSettings) {
        try {
            return await requirePremium('theme_settings', async () => {
                const currentTheme = this.getCurrentTheme();
                const newTheme = {
                    ...currentTheme,
                    ...themeSettings,
                    id: 'custom',
                    name: 'Custom'
                };

                await stateManager.updateSettings({ theme: newTheme });
                this.applyTheme(newTheme);

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

    // Initialize theme service
    initialize() {
        try {
            const currentTheme = this.getCurrentTheme();
            this.applyTheme(currentTheme);
        } catch (error) {
            console.error('Failed to initialize theme:', error);
            // Fallback to default theme
            this.applyTheme(this.defaultThemes[0]);
        }
    }
}

// Create and export singleton instance
const themeService = new ThemeService();
export default themeService;
export { ThemeError }; 