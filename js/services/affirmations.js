// Affirmations Service Module
import stateManager from '../modules/state.js';
import { withErrorBoundary } from '../utils/common.js';
import { requirePremium } from '../utils/premium.js';
import { defaultAffirmations } from '../data/affirmations.js';

class AffirmationError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'AffirmationError';
        this.code = code;
        this.details = details;
    }
}

class AffirmationsService {
    constructor() {
        this.defaultAffirmations = defaultAffirmations;
    }

    // Get all affirmations including custom ones
    getAllAffirmations() {
        const settings = stateManager.getSettings();
        const customAffirmations = settings.customAffirmations?.map(a => a.text) || [];
        return [...this.defaultAffirmations, ...customAffirmations];
    }

    // Get random affirmation
    getRandomAffirmation() {
        const affirmations = this.getAllAffirmations();
        return affirmations[Math.floor(Math.random() * affirmations.length)];
    }

    // Add custom affirmation (premium feature)
    async addCustomAffirmation(text) {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new AffirmationError('Invalid affirmation text', 'INVALID_TEXT');
        }

        try {
            return await requirePremium('custom_affirmations', async () => {
                const settings = stateManager.getSettings();
            const affirmation = {
                id: Date.now(),
                text: text.trim(),
                createdAt: new Date().toISOString()
            };

            await stateManager.updateSettings({
                customAffirmations: [...settings.customAffirmations, affirmation]
            });

            return affirmation;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new AffirmationError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new AffirmationError(
                'Failed to add custom affirmation',
                'ADD_CUSTOM_ERROR',
                { originalError: error }
            );
        }
    }

    // Remove custom affirmation
    async removeCustomAffirmation(id) {
        const settings = stateManager.getSettings();

        try {
            const updatedAffirmations = settings.customAffirmations.filter(a => a.id !== id);

            await stateManager.updateSettings({
                customAffirmations: updatedAffirmations
            });
        } catch (error) {
            throw new AffirmationError(
                'Failed to remove custom affirmation',
                'REMOVE_ERROR',
                { originalError: error }
            );
        }
    }

    // Get favorite affirmations with metadata
    async getFavoriteAffirmationsWithMetadata() {
        try {
            return await requirePremium('favorite_affirmations', async () => {
                const settings = stateManager.getSettings();
                const favorites = settings.favorites.affirmations || [];
                
                return favorites.map(text => ({
                    text,
                    addedAt: settings.favoritesMetadata?.[text]?.addedAt || new Date().toISOString(),
                    tags: settings.favoritesMetadata?.[text]?.tags || []
                }));
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new AffirmationError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new AffirmationError(
                'Failed to get favorite affirmations with metadata',
                'GET_FAVORITES_METADATA_ERROR',
                { originalError: error }
            );
        }
    }

    // Add affirmation to favorites with metadata
    async addToFavorites(text, tags = []) {
        try {
            return await requirePremium('favorite_affirmations', async () => {
                const settings = stateManager.getSettings();
                const favorites = settings.favorites.affirmations || [];
                
                if (favorites.includes(text)) {
                    return false; // Already favorited
                }

                const updatedFavorites = [...favorites, text];
                const metadata = {
                    ...(settings.favoritesMetadata || {}),
                    [text]: {
                        addedAt: new Date().toISOString(),
                        tags
                    }
                };

                await stateManager.updateSettings({
                    favorites: {
                        ...settings.favorites,
                        affirmations: updatedFavorites
                    },
                    favoritesMetadata: metadata
                });

                // Update UI
                this.updateFavoriteButton(text);
                return true;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new AffirmationError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new AffirmationError(
                'Failed to add to favorites',
                'ADD_FAVORITE_ERROR',
                { originalError: error }
            );
        }
    }

    // Remove affirmation from favorites
    async removeFromFavorites(text) {
        try {
            return await requirePremium('favorite_affirmations', async () => {
                const settings = stateManager.getSettings();
                const favorites = settings.favorites.affirmations || [];
                
                if (!favorites.includes(text)) {
                    return false; // Not in favorites
                }

                // Only update favorites list, don't touch custom affirmations
                const updatedFavorites = favorites.filter(fav => fav !== text);
                const metadata = { ...settings.favoritesMetadata };
                delete metadata[text];

                await stateManager.updateSettings({
                    favorites: {
                        ...settings.favorites,
                        affirmations: updatedFavorites
                    },
                    favoritesMetadata: metadata
                });

                // Update UI
                this.updateFavoriteButton(text);
                return true;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new AffirmationError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new AffirmationError(
                'Failed to remove from favorites',
                'REMOVE_FAVORITE_ERROR',
                { originalError: error }
            );
        }
    }

    // Update favorite affirmation metadata
    async updateFavoriteMetadata(text, updates) {
        try {
            return await requirePremium('favorite_affirmations', async () => {
                const settings = stateManager.getSettings();
                const favorites = settings.favorites.affirmations || [];
                
                if (!favorites.includes(text)) {
                    throw new AffirmationError('Affirmation not in favorites', 'NOT_FAVORITED');
                }

                const metadata = {
                    ...(settings.favoritesMetadata || {}),
                    [text]: {
                        ...(settings.favoritesMetadata?.[text] || {}),
                        ...updates
                    }
                };

                await stateManager.updateSettings({
                    favoritesMetadata: metadata
                });

                return metadata[text];
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new AffirmationError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new AffirmationError(
                'Failed to update favorite metadata',
                'UPDATE_METADATA_ERROR',
                { originalError: error }
            );
        }
    }

    // Modified toggleFavorite to use new methods
    async toggleFavorite(text) {
        const isFavorited = await this.isFavorited(text);
        return isFavorited ? 
            await this.removeFromFavorites(text) : 
            await this.addToFavorites(text);
    }

    // Check if affirmation is favorited
    async isFavorited(text) {
        try {
            const settings = stateManager.getSettings();
            return settings.favorites.affirmations.includes(text);
        } catch (error) {
            console.error('Error checking favorite status:', error);
            return false;
        }
    }

    // Update favorite button state
    async updateFavoriteButton(text) {
        const favoriteButton = document.querySelector('[data-action="favorite"]');
        if (!favoriteButton) return;

        const isFavorited = await this.isFavorited(text);
        favoriteButton.classList.toggle('active', isFavorited);
        const icon = favoriteButton.querySelector('.material-icons-round');
        if (icon) {
            icon.textContent = isFavorited ? 'favorite' : 'favorite_border';
        }
    }

    // Update affirmation display with favorite status
    async updateDisplay(affirmation) {
        const affirmationElement = document.getElementById('affirmation');
        if (!affirmationElement) return;

        // Add transition class
        affirmationElement.style.opacity = '0';
        affirmationElement.style.transform = 'translateY(10px)';

        setTimeout(async () => {
            affirmationElement.textContent = affirmation;

            // Update favorite button state
            await this.updateFavoriteButton(affirmation);

            // Trigger reflow
            void affirmationElement.offsetHeight;

            // Fade in with transform
            affirmationElement.style.opacity = '1';
            affirmationElement.style.transform = 'translateY(0)';
        }, 300);
    }

    // Main update function with error boundary
    update = withErrorBoundary(
        async () => {
            const affirmation = this.getRandomAffirmation();
            this.updateDisplay(affirmation);
        },
        () => {
            // Fallback to a default affirmation on error
            this.updateDisplay("Today is a new beginning");
        }
    );
}

// Create and export singleton instance
const affirmationsService = new AffirmationsService();
export default affirmationsService;
export { AffirmationError }; 