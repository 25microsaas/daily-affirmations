// Categories Service Module
import stateManager from '../modules/state.js';
import { requirePremium } from '../utils/premium.js';

class CategoryError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'CategoryError';
        this.code = code;
        this.details = details;
    }
}

class CategoriesService {
    constructor() {
        this.defaultCategories = [
            {
                id: 'self_love',
                name: 'Self Love',
                icon: 'favorite',
                color: '#e11d48'
            },
            {
                id: 'confidence',
                name: 'Confidence',
                icon: 'psychology',
                color: '#f59e0b'
            },
            {
                id: 'success',
                name: 'Success',
                icon: 'stars',
                color: '#22c55e'
            },
            {
                id: 'peace',
                name: 'Peace',
                icon: 'self_improvement',
                color: '#3b82f6'
            },
            {
                id: 'gratitude',
                name: 'Gratitude',
                icon: 'volunteer_activism',
                color: '#8b5cf6'
            }
        ];
    }

    // Get all categories
    getAllCategories() {
        const settings = stateManager.getSettings();
        const customCategories = settings.customCategories || [];
        return [...this.defaultCategories, ...customCategories];
    }

    // Get category by ID
    getCategory(categoryId) {
        return this.getAllCategories().find(c => c.id === categoryId);
    }

    // Create custom category
    async createCategory(category) {
        try {
            return await requirePremium('affirmation_categories', async () => {
                if (!category.name || typeof category.name !== 'string') {
                    throw new CategoryError('Invalid category name', 'INVALID_NAME');
                }

                const settings = stateManager.getSettings();
                const newCategory = {
                    id: `custom_${Date.now()}`,
                    icon: category.icon || 'label',
                    color: category.color || '#64748b',
                    ...category
                };

                await stateManager.updateSettings({
                    customCategories: [...(settings.customCategories || []), newCategory]
                });

                return newCategory;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new CategoryError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new CategoryError(
                'Failed to create category',
                'CREATE_CATEGORY_ERROR',
                { originalError: error }
            );
        }
    }

    // Update category
    async updateCategory(categoryId, updates) {
        try {
            return await requirePremium('affirmation_categories', async () => {
                const settings = stateManager.getSettings();
                const customCategories = settings.customCategories || [];
                const categoryIndex = customCategories.findIndex(c => c.id === categoryId);

                if (categoryIndex === -1) {
                    throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND');
                }

                const updatedCategory = {
                    ...customCategories[categoryIndex],
                    ...updates
                };

                const updatedCategories = [...customCategories];
                updatedCategories[categoryIndex] = updatedCategory;

                await stateManager.updateSettings({
                    customCategories: updatedCategories
                });

                return updatedCategory;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new CategoryError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new CategoryError(
                'Failed to update category',
                'UPDATE_CATEGORY_ERROR',
                { originalError: error }
            );
        }
    }

    // Delete category
    async deleteCategory(categoryId) {
        try {
            return await requirePremium('affirmation_categories', async () => {
                const settings = stateManager.getSettings();
                const customCategories = settings.customCategories || [];

                if (!customCategories.some(c => c.id === categoryId)) {
                    throw new CategoryError('Category not found', 'CATEGORY_NOT_FOUND');
                }

                const updatedCategories = customCategories.filter(c => c.id !== categoryId);

                await stateManager.updateSettings({
                    customCategories: updatedCategories
                });

                return true;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new CategoryError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new CategoryError(
                'Failed to delete category',
                'DELETE_CATEGORY_ERROR',
                { originalError: error }
            );
        }
    }

    // Get affirmations by category
    getAffirmationsByCategory(categoryId) {
        const settings = stateManager.getSettings();
        const affirmations = settings.categorizedAffirmations || {};
        return affirmations[categoryId] || [];
    }

    // Add affirmation to category
    async addAffirmationToCategory(affirmationId, categoryId) {
        try {
            return await requirePremium('affirmation_categories', async () => {
                const settings = stateManager.getSettings();
                const categorizedAffirmations = settings.categorizedAffirmations || {};
                const categoryAffirmations = categorizedAffirmations[categoryId] || [];

                if (categoryAffirmations.includes(affirmationId)) {
                    return false; // Already in category
                }

                await stateManager.updateSettings({
                    categorizedAffirmations: {
                        ...categorizedAffirmations,
                        [categoryId]: [...categoryAffirmations, affirmationId]
                    }
                });

                return true;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new CategoryError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new CategoryError(
                'Failed to add affirmation to category',
                'ADD_TO_CATEGORY_ERROR',
                { originalError: error }
            );
        }
    }

    // Remove affirmation from category
    async removeAffirmationFromCategory(affirmationId, categoryId) {
        try {
            return await requirePremium('affirmation_categories', async () => {
                const settings = stateManager.getSettings();
                const categorizedAffirmations = settings.categorizedAffirmations || {};
                const categoryAffirmations = categorizedAffirmations[categoryId] || [];

                if (!categoryAffirmations.includes(affirmationId)) {
                    return false; // Not in category
                }

                await stateManager.updateSettings({
                    categorizedAffirmations: {
                        ...categorizedAffirmations,
                        [categoryId]: categoryAffirmations.filter(id => id !== affirmationId)
                    }
                });

                return true;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new CategoryError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new CategoryError(
                'Failed to remove affirmation from category',
                'REMOVE_FROM_CATEGORY_ERROR',
                { originalError: error }
            );
        }
    }

    // Get categories for affirmation
    getCategoriesForAffirmation(affirmationId) {
        const settings = stateManager.getSettings();
        const categorizedAffirmations = settings.categorizedAffirmations || {};

        return Object.entries(categorizedAffirmations)
            .filter(([_, affirmations]) => affirmations.includes(affirmationId))
            .map(([categoryId]) => this.getCategory(categoryId))
            .filter(Boolean);
    }
}

// Create and export singleton instance
const categoriesService = new CategoriesService();
export default categoriesService;
export { CategoryError }; 