// Trial Experience Service Module
import stateManager from '../modules/state.js';
import { showNotification } from '../utils/common.js';
import tourService from './tour.js';

class TrialService {
    constructor() {
        this.DISCOUNT_PERCENTAGE = 20;
        this.TRIAL_FEATURES = [
            'custom_affirmations',
            'favorites',
            'daily_reminders',
            'share_affirmations'
        ];
    }

    // Show trial countdown
    showTrialCountdown() {
        const settings = stateManager.getSettings();
        if (settings.subscriptionStatus !== 'trial') return;

        const trialEnd = new Date(settings.trialEndsAt);
        const now = new Date();
        const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 0) {
            this.handleTrialEnd();
            return;
        }

        // Update countdown UI
        const countdownElement = document.querySelector('.trial-countdown');
        if (countdownElement) {
            countdownElement.textContent = `${daysLeft} days left`;
            countdownElement.classList.remove('hidden');
        }

        // Show reminder if less than 2 days left
        if (daysLeft <= 2) {
            this.showTrialEndingReminder(daysLeft);
        }
    }

    // Show trial ending reminder
    showTrialEndingReminder(daysLeft) {
        const message = daysLeft === 1
            ? "Your trial ends tomorrow! Upgrade now to keep your premium features and get 20% off!"
            : `Your trial ends in ${daysLeft} days! Don't forget to upgrade to keep your premium features.`;

        showNotification('Trial Ending Soon', message, 10000);
    }

    // Handle trial end
    async handleTrialEnd() {
        const settings = stateManager.getSettings();
        
        // Save user's custom data
        const customData = {
            customAffirmations: settings.customAffirmations || [],
            favorites: settings.favorites || [],
            reminders: settings.reminders || []
        };

        await stateManager.updateSettings({
            subscriptionStatus: 'free',
            trialEndsAt: null,
            savedTrialData: customData
        });

        showNotification(
            'Trial Ended',
            'Upgrade now to restore your premium features and saved data!',
            0
        );

        // Show special offer modal
        this.showSpecialOfferModal();
    }

    // Show special offer modal
    showSpecialOfferModal() {
        const modal = document.getElementById('specialOfferModal');
        if (!modal) return;

        const newModal = modal.cloneNode(true);
        modal.parentNode.replaceChild(newModal, modal);

        newModal.classList.remove('hidden');
        
        const upgradeButton = newModal.querySelector('.upgrade-button');
        upgradeButton?.addEventListener('click', () => {
            window.open(
                `https://your-subscription-url.com/checkout?discount=${this.DISCOUNT_PERCENTAGE}`,
                '_blank'
            );
        });
    }

    // Add premium badges to features
    addPremiumBadges() {
        document.querySelectorAll('[data-premium-feature]').forEach(element => {
            const featureId = element.dataset.premiumFeature;
            const badge = document.createElement('span');
            
            badge.className = 'premium-badge';
            badge.textContent = this.TRIAL_FEATURES.includes(featureId) ? 'Trial' : 'Pro';
            
            element.appendChild(badge);
        });
    }

    // Show feature tour
    showFeatureTour() {
        // Use tour service instead of direct implementation
        tourService.start();
    }

    // Initialize trial experience
    initialize() {
        this.showTrialCountdown();
        this.addPremiumBadges();
        
        const settings = stateManager.getSettings();
        if (settings.subscriptionStatus === 'trial' && !settings.tourShown) {
            this.showFeatureTour();
            stateManager.updateSettings({ tourShown: true });
        }
    }
}

// Create and export singleton instance
const trialService = new TrialService();
export default trialService; 