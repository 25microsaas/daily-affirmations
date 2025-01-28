// Feature Tour Service
import Shepherd from 'shepherd.js';
import stateManager from '../modules/state.js';

class TourService {
    constructor() {
        this.tour = null;
        this.steps = [
            {
                id: 'welcome',
                title: 'Welcome to Daily Affirmations',
                text: 'Let\'s take a quick tour to help you get started.',
                attachTo: { element: '.affirmation-card', on: 'bottom' },
                buttons: [
                    {
                        text: 'Skip Tour',
                        action: () => this.endTour()
                    },
                    {
                        text: 'Next',
                        action: () => this.tour.next()
                    }
                ],
                classes: 'shepherd-theme-custom'
            },
            {
                id: 'affirmation',
                title: 'Daily Affirmations',
                text: 'Each day, you\'ll receive a new affirmation to inspire and motivate you.',
                attachTo: { element: '.affirmation-text', on: 'bottom' },
                buttons: [
                    {
                        text: 'Back',
                        action: () => this.tour.back()
                    },
                    {
                        text: 'Next',
                        action: () => this.tour.next()
                    }
                ]
            },
            {
                id: 'actions',
                title: 'Affirmation Actions',
                text: 'You can refresh for a new affirmation, copy it, add to favorites, or share with others.',
                attachTo: { element: '.affirmation-actions', on: 'bottom' },
                buttons: [
                    {
                        text: 'Back',
                        action: () => this.tour.back()
                    },
                    {
                        text: 'Next',
                        action: () => this.tour.next()
                    }
                ]
            },
            {
                id: 'settings',
                title: 'Customize Your Experience',
                text: 'Access settings to customize themes, backgrounds, and notifications.',
                attachTo: { element: '#settingsButton', on: 'left' },
                buttons: [
                    {
                        text: 'Back',
                        action: () => this.tour.back()
                    },
                    {
                        text: 'Next',
                        action: () => this.tour.next()
                    }
                ]
            },
            {
                id: 'menu',
                title: 'Main Menu',
                text: 'Access your favorites, custom affirmations, and premium features.',
                attachTo: { element: '#menuButton', on: 'left' },
                buttons: [
                    {
                        text: 'Back',
                        action: () => this.tour.back()
                    },
                    {
                        text: 'Next',
                        action: () => this.tour.next()
                    }
                ]
            },
            {
                id: 'focus',
                title: 'Focus Mode',
                text: 'Enter focus mode to minimize distractions and concentrate on your affirmation.',
                attachTo: { element: '#focusModeButton', on: 'left' },
                buttons: [
                    {
                        text: 'Back',
                        action: () => this.tour.back()
                    },
                    {
                        text: 'Next',
                        action: () => this.tour.next()
                    }
                ]
            },
            {
                id: 'premium',
                title: 'Premium Features',
                text: 'Unlock custom affirmations, backgrounds, and more with our premium features.',
                attachTo: { element: '.premium-banner', on: 'top' },
                buttons: [
                    {
                        text: 'Back',
                        action: () => this.tour.back()
                    },
                    {
                        text: 'Finish Tour',
                        action: () => this.completeTour()
                    }
                ]
            }
        ];
    }

    initialize() {

        // Check if user has completed onboarding
        const settings = stateManager.getSettings();
        if (settings.onboardingCompleted) {
            return;
        }

        this.setupTour();
        this.startTour();
    }

    setupTour() {
        this.tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'shepherd-theme-custom',
                scrollTo: true,
                cancelIcon: {
                    enabled: true
                }
            }
        });

        // Add steps to tour
        this.steps.forEach(step => this.tour.addStep(step));

        // Setup event listeners
        this.tour.on('cancel', () => this.endTour());
        this.tour.on('complete', () => this.completeTour());
    }

    startTour() {
        if (this.tour) {
            this.tour.start();
        }
    }

    async completeTour() {
        await stateManager.updateSettings({
            onboardingCompleted: true
        });
        this.tour.complete();
        this.showPremiumOffer();
    }

    endTour() {
        if (this.tour) {
            this.tour.cancel();
        }
    }

    showPremiumOffer() {
        // Show premium modal after tour completion
        const premiumDialog = document.getElementById('premiumDialog');
        if (premiumDialog) {
            premiumDialog.classList.add('visible');
        }
    }

    // Add custom styles for the tour
    addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .shepherd-theme-custom {
                --shepherd-bg: rgba(0, 0, 0, 0.9);
                --shepherd-text: #fff;
                --shepherd-primary: #22c55e;
            }

            .shepherd-theme-custom .shepherd-content {
                border-radius: 12px;
                padding: 16px;
            }

            .shepherd-theme-custom .shepherd-text {
                color: var(--shepherd-text);
                font-size: 14px;
                line-height: 1.6;
            }

            .shepherd-theme-custom .shepherd-header {
                padding-bottom: 8px;
            }

            .shepherd-theme-custom .shepherd-title {
                color: var(--shepherd-primary);
                font-size: 18px;
                font-weight: 600;
            }

            .shepherd-theme-custom .shepherd-button {
                background: var(--shepherd-primary);
                border: none;
                border-radius: 6px;
                color: white;
                cursor: pointer;
                margin-right: 8px;
                padding: 8px 16px;
                transition: background 0.2s;
            }

            .shepherd-theme-custom .shepherd-button:hover {
                background: #16a34a;
            }

            .shepherd-theme-custom .shepherd-button.shepherd-button-secondary {
                background: transparent;
                border: 1px solid var(--shepherd-primary);
            }

            .shepherd-theme-custom .shepherd-button.shepherd-button-secondary:hover {
                background: rgba(34, 197, 94, 0.1);
            }
        `;
        document.head.appendChild(style);
    }
}

// Create and export singleton instance
const tourService = new TourService();
export default tourService; 