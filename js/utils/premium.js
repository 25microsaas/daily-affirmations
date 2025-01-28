// Premium Feature Utilities
import premiumService from '../services/premium.js';
import premiumModal from '../services/premiumModal.js';

/**
 * Centralized premium feature check
 * @param {string} featureId - ID of the premium feature to check
 * @param {Function} action - Callback function to execute if premium check passes
 * @returns {Promise<any>} - Returns the result of the action if premium check passes
 * @throws {Error} - Throws error if premium check fails
 */
export async function requirePremium(featureId, action) {
    const hasAccess = await premiumService.checkFeatureAccess(featureId);
    if (!hasAccess) {
        premiumModal.show(featureId);   
        throw new Error('Premium feature not available');
    }
    return action();
}

/**
 * Wrapper for UI elements that require premium
 * @param {HTMLElement} element - Element to check premium status for
 * @param {string} featureId - ID of the premium feature
 */
export async function setupPremiumUI(element, featureId) {
    if (!element) return;

    const hasAccess = await premiumService.checkFeatureAccess(featureId);
    if (!hasAccess) {
        element.classList.add('disabled');
        element.addEventListener('click', (e) => {
            e.preventDefault();
            premiumModal.show(featureId);
        });
    } else {
        element.classList.remove('disabled');
    }
} 