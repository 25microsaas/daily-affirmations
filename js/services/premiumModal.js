import premiumService from './premium.js';
import { showNotification } from '../utils/common.js';

class PremiumModal {
    constructor() {
        this.modal = null;
        this.isVisible = false;
        this.currentFeature = null;
    }

    initialize() {
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        const modal = document.createElement('div');
        modal.className = 'premium-modal';
        modal.innerHTML = `
            <div class="premium-modal-content glass">
                <div class="premium-modal-header">
                    <h2>Unlock Premium Features</h2>
                    <button class="close-button">×</button>
                </div>
                
                <div class="premium-modal-body">
                    <div class="premium-features">
                        ${this.renderFeatures()}
                    </div>
                    
                    <div class="premium-plans">
                        <div class="plan-card">
                            <h3>Monthly</h3>
                            <div class="price">$4.99<span>/month</span></div>
                            <ul>
                                <li>All Premium Features</li>
                                <li>Priority Support</li>
                                <li>Cancel Anytime</li>
                            </ul>
                            <button class="upgrade-button" data-plan="monthly">Choose Monthly</button>
                        </div>
                        
                        <div class="plan-card featured">
                            <div class="best-value">Best Value</div>
                            <h3>Yearly</h3>
                            <div class="price">$39.99<span>/year</span></div>
                            <div class="savings">Save 33%</div>
                            <ul>
                                <li>All Premium Features</li>
                                <li>Priority Support</li>
                                <li>Cancel Anytime</li>
                                <li>2 Months Free</li>
                            </ul>
                            <button class="upgrade-button primary" data-plan="yearly">Choose Yearly</button>
                        </div>
                    </div>
                    
                    <div class="premium-trial">
                        <p>Not sure yet? Try Premium free for 7 days</p>
                        <button class="trial-button">Start Free Trial</button>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .premium-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            }
            
            .premium-modal.visible {
                display: flex;
            }
            
            .premium-modal-content {
                width: 90%;
                max-width: 800px;
                max-height: 90vh;
                overflow-y: auto;
                border-radius: 16px;
                padding: 24px;
            }
            
            .premium-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
            }
            
            .premium-modal-header h2 {
                margin: 0;
                font-size: 24px;
                color: #22c55e;
            }
            
            .close-button {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
            }
            
            .premium-features {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 32px;
            }
            
            .feature-card {
                padding: 16px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.1);
                text-align: center;
            }
            
            .feature-card i {
                font-size: 32px;
                color: #22c55e;
                margin-bottom: 8px;
            }
            
            .premium-plans {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 24px;
                margin-bottom: 32px;
            }
            
            .plan-card {
                padding: 24px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.1);
                text-align: center;
                position: relative;
            }
            
            .plan-card.featured {
                background: rgba(34, 197, 94, 0.2);
                border: 2px solid #22c55e;
            }
            
            .best-value {
                position: absolute;
                top: -12px;
                left: 50%;
                transform: translateX(-50%);
                background: #22c55e;
                color: white;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
            }
            
            .price {
                font-size: 36px;
                font-weight: 600;
                color: #22c55e;
                margin: 16px 0;
            }
            
            .price span {
                font-size: 16px;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .savings {
                color: #22c55e;
                font-weight: 600;
                margin-bottom: 16px;
            }
            
            .plan-card ul {
                list-style: none;
                padding: 0;
                margin: 0 0 24px;
            }
            
            .plan-card li {
                margin-bottom: 8px;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .upgrade-button {
                width: 100%;
                padding: 12px;
                border: 1px solid #22c55e;
                border-radius: 8px;
                background: transparent;
                color: #22c55e;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .upgrade-button.primary {
                background: #22c55e;
                color: white;
            }
            
            .upgrade-button:hover {
                background: #22c55e;
                color: white;
            }
            
            .premium-trial {
                text-align: center;
                padding-top: 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .trial-button {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                background: transparent;
                color: #22c55e;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .trial-button:hover {
                background: rgba(34, 197, 94, 0.1);
            }
        `;
        document.head.appendChild(style);

        this.modal = modal;
        document.body.appendChild(modal);
    }

    renderFeatures() {
        const features = premiumService.features;
        return Object.values(features)
            .map(feature => `
                <div class="feature-card">
                    <i class="material-icons-round">${feature.icon}</i>
                    <h3>${feature.name}</h3>
                    <p>${feature.description}</p>
                </div>
            `)
            .join('');
    }

    setupEventListeners() {
        if (!this.modal) return;

        // Close button
        this.modal.querySelector('.close-button').addEventListener('click', () => {
            this.hide();
        });

        // Upgrade buttons
        this.modal.querySelectorAll('.upgrade-button').forEach(button => {
            button.addEventListener('click', async () => {
                const plan = button.dataset.plan;
                try {
                    await premiumService.upgradeToPro();
                    this.hide();
                    showNotification('Welcome to Premium!', 'You now have access to all premium features.');
                } catch (error) {
                    showNotification('Error', 'Failed to process upgrade. Please try again.');
                }
            });
        });

        // Trial button
        this.modal.querySelector('.trial-button').addEventListener('click', async () => {
            try {
                await premiumService.startFreeTrial();
                this.hide();
            } catch (error) {
                console.error('Trial start error in modal:', error);
            }
        });

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }

    show(feature = null) {
        if (!this.modal) {
            this.initialize();
        }
        this.currentFeature = feature;
        this.modal.classList.add('visible');
        this.isVisible = true;
    }

    hide() {
        if (this.modal) {
            this.modal.classList.remove('visible');
            this.isVisible = false;
        }
    }

    toggle(feature = null) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(feature);
        }
    }
}

const premiumModal = new PremiumModal();
export default premiumModal; 