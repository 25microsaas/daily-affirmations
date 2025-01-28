// Premium UI Components
import { createElement } from '../utils/dom.js';

export class PremiumUI {
    static createBadge(type, text) {
        return createElement('span', {
            className: `premium-badge premium-badge-${type}`,
            textContent: text,
            style: {
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500',
                textTransform: 'uppercase',
                background: type === 'pro' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 
                           type === 'trial' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 
                           'linear-gradient(135deg, #64748b, #475569)',
                color: '#ffffff',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }
        });
    }

    static createModal(title, content, buttons) {
        const modal = createElement('div', {
            className: 'premium-modal',
            style: {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: '9999'
            }
        });

        const dialog = createElement('div', {
            className: 'premium-modal-dialog',
            style: {
                background: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '480px',
                width: '90%',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                position: 'relative'
            }
        });

        const closeButton = createElement('button', {
            className: 'premium-modal-close',
            innerHTML: '&times;',
            style: {
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#64748b'
            },
            onclick: () => modal.remove()
        });

        const titleElement = createElement('h2', {
            className: 'premium-modal-title',
            textContent: title,
            style: {
                margin: '0 0 16px',
                fontSize: '24px',
                fontWeight: '600',
                color: '#1a1a1a'
            }
        });

        const contentElement = createElement('div', {
            className: 'premium-modal-content',
            style: {
                marginBottom: '24px',
                color: '#4b5563',
                lineHeight: '1.6'
            }
        });

        if (typeof content === 'string') {
            contentElement.textContent = content;
        } else {
            contentElement.appendChild(content);
        }

        const buttonContainer = createElement('div', {
            className: 'premium-modal-buttons',
            style: {
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
            }
        });

        buttons.forEach(({ text, type = 'secondary', onClick }) => {
            const button = createElement('button', {
                className: `premium-button premium-button-${type}`,
                textContent: text,
                onclick: onClick,
                style: {
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: type === 'primary' ? '#22c55e' : '#ffffff',
                    color: type === 'primary' ? '#ffffff' : '#4b5563',
                    border: type === 'primary' ? 'none' : '1px solid #e5e7eb'
                }
            });
            buttonContainer.appendChild(button);
        });

        dialog.append(closeButton, titleElement, contentElement, buttonContainer);
        modal.appendChild(dialog);
        document.body.appendChild(modal);

        return modal;
    }

    static createSpecialOfferModal(discount) {
        const content = createElement('div', {
            style: { textAlign: 'center' }
        });

        content.innerHTML = `
            <div class="offer-icon" style="font-size: 48px; margin-bottom: 16px;">🎉</div>
            <p style="font-size: 18px; margin-bottom: 24px;">
                Upgrade now and get <strong>${discount}% off</strong> your subscription!
            </p>
            <div class="offer-features" style="text-align: left; margin-bottom: 24px;">
                <h3 style="font-size: 16px; margin-bottom: 12px;">You'll get access to:</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="margin-bottom: 8px; display: flex; align-items: center;">
                        <span style="color: #22c55e; margin-right: 8px;">✓</span>
                        Custom Affirmations
                    </li>
                    <li style="margin-bottom: 8px; display: flex; align-items: center;">
                        <span style="color: #22c55e; margin-right: 8px;">✓</span>
                        Custom Backgrounds
                    </li>
                    <li style="margin-bottom: 8px; display: flex; align-items: center;">
                        <span style="color: #22c55e; margin-right: 8px;">✓</span>
                        Theme Settings
                    </li>
                    <li style="margin-bottom: 8px; display: flex; align-items: center;">
                        <span style="color: #22c55e; margin-right: 8px;">✓</span>
                        Cloud Backup & Sync
                    </li>
                </ul>
            </div>
        `;

        return this.createModal('Special Offer!', content, [
            {
                text: 'Upgrade Now',
                type: 'primary',
                onClick: () => {
                    window.open(
                        `https://your-subscription-url.com/checkout?discount=${discount}`,
                        '_blank'
                    );
                }
            },
            {
                text: 'Maybe Later',
                type: 'secondary',
                onClick: (e) => e.target.closest('.premium-modal').remove()
            }
        ]);
    }

    static createFeatureBadge(feature) {
        const badge = createElement('div', {
            className: 'feature-badge',
            style: {
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                color: '#64748b',
                cursor: 'help'
            }
        });

        const icon = createElement('span', {
            className: 'material-icons',
            textContent: feature.icon,
            style: {
                fontSize: '16px',
                color: '#22c55e'
            }
        });

        const text = createElement('span', {
            textContent: feature.name
        });

        badge.append(icon, text);

        // Add tooltip
        badge.title = feature.description;

        return badge;
    }

    static createPlanCard(plan) {
        const card = createElement('div', {
            className: 'plan-card',
            style: {
                background: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                maxWidth: '320px'
            }
        });

        const header = createElement('div', {
            style: {
                marginBottom: '24px',
                textAlign: 'center'
            }
        });

        header.innerHTML = `
            <h3 style="margin: 0 0 8px; font-size: 24px; color: #1a1a1a;">
                ${plan.name}
            </h3>
            <div class="price" style="font-size: 36px; font-weight: 600; color: #22c55e;">
                $${plan.price}
                <span style="font-size: 16px; color: #64748b; font-weight: 400;">
                    /${plan.billingPeriod}
                </span>
            </div>
        `;

        const features = createElement('ul', {
            style: {
                listStyle: 'none',
                padding: '0',
                margin: '0 0 24px'
            }
        });

        const featureList = Array.isArray(plan.features) ? plan.features :
            plan.features === 'all' ? ['All Premium Features'] :
            [`All ${plan.features.charAt(0).toUpperCase() + plan.features.slice(1)} Features`];

        featureList.forEach(feature => {
            const li = createElement('li', {
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    color: '#4b5563'
                }
            });

            const checkmark = createElement('span', {
                className: 'material-icons',
                textContent: 'check_circle',
                style: {
                    color: '#22c55e',
                    fontSize: '18px'
                }
            });

            const text = createElement('span', {
                textContent: feature
            });

            li.append(checkmark, text);
            features.appendChild(li);
        });

        const button = createElement('button', {
            className: 'premium-button premium-button-primary',
            textContent: 'Choose Plan',
            style: {
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: '#22c55e',
                color: '#ffffff',
                border: 'none',
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
            },
            onclick: () => {
                // Handle plan selection
                window.open(
                    `https://your-subscription-url.com/checkout?plan=${plan.id}`,
                    '_blank'
                );
            }
        });

        card.append(header, features, button);
        return card;
    }
}

export default PremiumUI; 