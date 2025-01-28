// Info Dialogs Component
class InfoDialogs {
    constructor() {
        this.initialize();
    }

    initialize() {
        this.setupEventListeners();
        this.createDialogs();
    }

    setupEventListeners() {
        const footerButtons = document.querySelectorAll('.menu-footer-btn');
        footerButtons.forEach(button => {
            const action = button.getAttribute('title')?.toLowerCase();
            if (action) {
                button.addEventListener('click', () => {
                    const dialogId = `${action.replace('send ', '')}Dialog`;
                    const dialog = document.getElementById(dialogId);
                    if (dialog) {
                        dialog.classList.add('visible');
                        dialog.classList.add('show');
                    }
                });
            }
        });
    }

    createDialogs() {
        // Create Help dialog
        this.createDialog('help', {
            title: 'Help',
            content: `
                <div class="help-list">
                    <div class="help-item">
                        <i class="material-icons-round">new_releases</i>
                        <div>
                            <strong>Getting Started</strong>
                            <p>New affirmations appear every time you open a new tab. Click the refresh button to see a new one.</p>
                        </div>
                    </div>
                    <div class="help-item">
                        <i class="material-icons-round">favorite</i>
                        <div>
                            <strong>Favorites</strong>
                            <p>Click the heart icon to save affirmations you love. Access them anytime from the menu.</p>
                        </div>
                    </div>
                    <div class="help-item">
                        <i class="material-icons-round">edit</i>
                        <div>
                            <strong>Custom Affirmations</strong>
                            <p>Create and manage your own affirmations in the Custom Affirmations section.</p>
                        </div>
                    </div>
                </div>
            `
        });

        // Create Feedback dialog
        this.createDialog('feedback', {
            title: 'Send Feedback',
            content: `
                <div class="feedback-intro">
                    <i class="material-icons-round">chat</i>
                    <div>
                        <h4>We'd love to hear from you!</h4>
                        <p>Your feedback helps us improve Daily Affirmations for everyone.</p>
                    </div>
                </div>
                <form class="feedback-form">
                    <select class="dialog-input" name="type" required>
                        <option value="" disabled selected>Select feedback type</option>
                        <option value="suggestion">Suggestion</option>
                        <option value="bug">Bug Report</option>
                        <option value="other">Other</option>
                    </select>
                    <input type="email" class="dialog-input" name="email" placeholder="Your email (optional)">
                    <textarea class="dialog-input" name="message" rows="4" placeholder="Tell us what you think..." required></textarea>
                    <label class="checkbox-label">
                        <input type="checkbox" name="subscribe">
                        Keep me updated on new features
                    </label>
                    <button type="submit" class="dialog-button primary">
                        <i class="material-icons-round">send</i>
                        Send Feedback
                    </button>
                </form>
            `
        });

        // Create About dialog
        this.createDialog('about', {
            title: 'About Daily Affirmations',
            content: `
                <div class="about-header">
                    <h4>Version 1.0.0</h4>
                    <p>Transform your mindset with daily positive affirmations.</p>
                </div>
                <div class="about-features">
                    <ul>
                        <li><i class="material-icons-round">auto_awesome</i> Daily curated affirmations</li>
                        <li><i class="material-icons-round">favorite</i> Save your favorites</li>
                        <li><i class="material-icons-round">edit</i> Create custom affirmations</li>
                        <li><i class="material-icons-round">backup</i> Cloud backup & sync</li>
                    </ul>
                </div>
                <div class="about-footer">
                    <div class="about-links">
                        <a href="/privacy" target="_blank">Privacy Policy</a>
                        <span class="separator">•</span>
                        <a href="/terms" target="_blank">Terms of Service</a>
                    </div>
                    <p class="copyright">© 2024 Daily Affirmations. All rights reserved.</p>
                </div>
            `
        });
    }

    createDialog(id, { title, content }) {
        const dialog = document.createElement('div');
        dialog.id = `${id}Dialog`;
        dialog.className = 'dialog-base';
        
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>${title}</h3>
                    <button class="close-button">
                        <i class="material-icons-round">close</i>
                    </button>
                </div>
                <div class="dialog-body">
                    ${content}
                </div>
            </div>
        `;

        // Add event listeners
        const closeButton = dialog.querySelector('.close-button');
        closeButton?.addEventListener('click', () => {
            dialog.classList.remove('visible');
            dialog.classList.remove('show');
        });

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.classList.remove('visible');
                dialog.classList.remove('show');
            }
        });

        // Handle feedback form submission
        if (id === 'feedback') {
            const form = dialog.querySelector('.feedback-form');
            form?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                
                // Get submit button reference before try block
                const submitButton = form.querySelector('button[type="submit"]');
                const originalText = submitButton.innerHTML;
                
                try {
                    // Show loading state
                    submitButton.disabled = true;
                    submitButton.innerHTML = '<i class="material-icons-round">hourglass_top</i> Sending...';
                    
                    // Send feedback to API
                    const response = await fetch('https://daily-affirmation.today/api/feedback', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: data.type,
                            email: data.email || undefined,
                            message: data.message,
                            subscribe: data.subscribe === 'on',
                            source: 'chrome_extension',
                            version: chrome.runtime.getManifest().version
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to send feedback');
                    }
                    
                    // Success
                    dialog.classList.remove('visible');
                    dialog.classList.remove('show');
                    this.showNotification('Thank you!', 'Your feedback has been received. We appreciate your input!');
                    form.reset();
                } catch (error) {
                    console.error('Failed to submit feedback:', error);
                    this.showNotification('Error', 'Failed to send feedback. Please try again.');
                } finally {
                    // Reset button state
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalText;
                }
            });
        }

        document.body.appendChild(dialog);
    }

    showNotification(title, message) {
        const notification = document.createElement('div');
        notification.className = 'notification glass';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

// Create and export singleton instance
const infoDialogs = new InfoDialogs();
export default infoDialogs; 