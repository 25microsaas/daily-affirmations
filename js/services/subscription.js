// Subscription Management Service Module
import stateManager from '../modules/state.js';
import { showNotification } from '../utils/common.js';

class SubscriptionError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'SubscriptionError';
        this.code = code;
        this.details = details;
    }
}

class SubscriptionService {
    constructor() {
        this.plans = {
            basic: {
                id: 'basic',
                name: 'Basic',
                price: 4.99,
                billingPeriod: 'monthly',
                features: [
                    'custom_affirmations',
                    'favorites',
                    'daily_reminders',
                    'share_affirmations'
                ]
            },
            pro: {
                id: 'pro',
                name: 'Pro',
                price: 9.99,
                billingPeriod: 'monthly',
                features: [
                    'custom_affirmations',
                    'custom_backgrounds',
                    'favorites',
                    'daily_reminders',
                    'share_affirmations',
                    'backup_sync',
                    'theme_settings'
                ]
            },
            enterprise: {
                id: 'enterprise',
                name: 'Enterprise',
                price: 24.99,
                billingPeriod: 'monthly',
                features: 'all'
            },
            family: {
                id: 'family',
                name: 'Family',
                price: 19.99,
                billingPeriod: 'monthly',
                features: 'pro',
                members: 5
            }
        };

        this.referralDiscount = 0.15; // 15% discount
    }

    // Get available plans
    getPlans() {
        return this.plans;
    }

    // Get current subscription
    getCurrentSubscription() {
        const settings = stateManager.getSettings();
        return {
            status: settings.subscriptionStatus || 'free',
            plan: settings.subscriptionPlan,
            startDate: settings.subscriptionStartDate,
            endDate: settings.subscriptionEndDate,
            autoRenew: settings.autoRenew || false
        };
    }

    // Update subscription
    async updateSubscription(planId) {
        try {
            const plan = this.plans[planId];
            if (!plan) {
                throw new SubscriptionError('Invalid plan', 'INVALID_PLAN');
            }

            const now = new Date();
            const endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + 1);

            await stateManager.updateSettings({
                subscriptionStatus: planId,
                subscriptionPlan: plan,
                subscriptionStartDate: now.toISOString(),
                subscriptionEndDate: endDate.toISOString(),
                autoRenew: true
            });

            showNotification(
                'Subscription Updated',
                `You are now subscribed to ${plan.name}!`
            );

            return this.getCurrentSubscription();
        } catch (error) {
            throw new SubscriptionError(
                'Failed to update subscription',
                'UPDATE_ERROR',
                { originalError: error }
            );
        }
    }

    // Cancel subscription
    async cancelSubscription() {
        try {
            const settings = stateManager.getSettings();
            
            await stateManager.updateSettings({
                autoRenew: false
            });

            showNotification(
                'Subscription Cancelled',
                'Your subscription will end on ' + 
                new Date(settings.subscriptionEndDate).toLocaleDateString()
            );

            return this.getCurrentSubscription();
        } catch (error) {
            throw new SubscriptionError(
                'Failed to cancel subscription',
                'CANCEL_ERROR',
                { originalError: error }
            );
        }
    }

    // Generate gift code
    async generateGiftCode(planId, months = 1) {
        try {
            const plan = this.plans[planId];
            if (!plan) {
                throw new SubscriptionError('Invalid plan', 'INVALID_PLAN');
            }

            const code = `GIFT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const settings = stateManager.getSettings();
            
            await stateManager.updateSettings({
                giftCodes: {
                    ...(settings.giftCodes || {}),
                    [code]: {
                        planId,
                        months,
                        created: new Date().toISOString(),
                        used: false
                    }
                }
            });

            return code;
        } catch (error) {
            throw new SubscriptionError(
                'Failed to generate gift code',
                'GIFT_CODE_ERROR',
                { originalError: error }
            );
        }
    }

    // Redeem gift code
    async redeemGiftCode(code) {
        try {
            const settings = stateManager.getSettings();
            const giftCode = settings.giftCodes?.[code];

            if (!giftCode || giftCode.used) {
                throw new SubscriptionError('Invalid or used code', 'INVALID_CODE');
            }

            const plan = this.plans[giftCode.planId];
            const now = new Date();
            const endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + giftCode.months);

            await stateManager.updateSettings({
                subscriptionStatus: giftCode.planId,
                subscriptionPlan: plan,
                subscriptionStartDate: now.toISOString(),
                subscriptionEndDate: endDate.toISOString(),
                autoRenew: false,
                giftCodes: {
                    ...settings.giftCodes,
                    [code]: { ...giftCode, used: true }
                }
            });

            showNotification(
                'Gift Code Redeemed',
                `You now have ${giftCode.months} months of ${plan.name}!`
            );

            return this.getCurrentSubscription();
        } catch (error) {
            throw new SubscriptionError(
                'Failed to redeem gift code',
                'REDEEM_ERROR',
                { originalError: error }
            );
        }
    }

    // Generate referral code
    async generateReferralCode() {
        try {
            const settings = stateManager.getSettings();
            if (settings.referralCode) {
                return settings.referralCode;
            }

            const code = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            
            await stateManager.updateSettings({
                referralCode: code,
                referralCount: 0
            });

            return code;
        } catch (error) {
            throw new SubscriptionError(
                'Failed to generate referral code',
                'REFERRAL_CODE_ERROR',
                { originalError: error }
            );
        }
    }

    // Apply referral code
    async applyReferralCode(code) {
        try {
            // TODO: Validate referral code with backend
            const isValid = code.startsWith('REF-');
            
            if (!isValid) {
                throw new SubscriptionError('Invalid referral code', 'INVALID_CODE');
            }

            await stateManager.updateSettings({
                appliedReferralCode: code,
                referralDiscount: this.referralDiscount
            });

            showNotification(
                'Referral Applied',
                `You'll get ${this.referralDiscount * 100}% off your subscription!`
            );

            return true;
        } catch (error) {
            throw new SubscriptionError(
                'Failed to apply referral code',
                'APPLY_REFERRAL_ERROR',
                { originalError: error }
            );
        }
    }
}

// Create and export singleton instance
const subscriptionService = new SubscriptionService();
export default subscriptionService;
export { SubscriptionError }; 