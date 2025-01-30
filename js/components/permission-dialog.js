// Permission Dialog Component
export class PermissionDialog {
    constructor() {
        this.dialog = null;
        this.createDialog();
    }

    createDialog() {
        this.dialog = document.createElement('div');
        this.dialog.className = 'permission-dialog glass hidden';
        this.dialog.innerHTML = `
            <div class="permission-content">
                <h2>Enable Enhanced Features</h2>
                <p>To provide you with the best experience, Daily Affirmations needs permission to:</p>
                <ul>
                    <li>💾 Save your preferences</li>
                    <li>🔔 Send daily reminders (optional)</li>
                    <li>🌤️ Show weather information (optional)</li>
                    <li>⚡ Work offline</li>
                </ul>
                <div class="permission-buttons">
                    <button class="btn-primary" id="acceptPermissions">Enable Features</button>
                    <button class="btn-secondary" id="declinePermissions">Continue with Basic Features</button>
                </div>
                <p class="permission-note">You can change these settings anytime in the extension options.</p>
            </div>
        `;

        document.body.appendChild(this.dialog);
        this.setupEventListeners();
    }

    setupEventListeners() {
        const acceptBtn = this.dialog.querySelector('#acceptPermissions');
        const declineBtn = this.dialog.querySelector('#declinePermissions');

        acceptBtn.addEventListener('click', () => {
            this.hide();
            this.requestPermissions();
        });

        declineBtn.addEventListener('click', () => {
            this.hide();
            this.handleDeclinedPermissions();
        });
    }

    async requestPermissions() {
        try {
            // Request required permissions
            const permissions = {
                permissions: ['storage', 'notifications', 'background'],
                origins: ['https://api.openweathermap.org/*']
            };

            const granted = await chrome.permissions.request(permissions);
            
            if (granted) {
                // Save permission state
                await chrome.storage.local.set({ permissionsGranted: true });
                // Initialize service worker
                this.initializeServiceWorker();
            } else {
                this.handleDeclinedPermissions();
            }
        } catch (error) {
            console.error('Permission request failed:', error);
            this.handleDeclinedPermissions();
        }
    }

    async initializeServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/background-worker.js', {
                    scope: '/',
                    type: 'module'
                });
                console.debug('ServiceWorker registered:', registration);
                
                await navigator.serviceWorker.ready;
                console.debug('ServiceWorker is ready');
                
                if (registration.active) {
                    console.debug('ServiceWorker is active');
                }
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
                handleOfflineCapability();
            }
        }
    }

    handleDeclinedPermissions() {
        // Save declined state
        chrome.storage.local.set({ permissionsGranted: false });
        // Initialize basic features only
        handleOfflineCapability();
    }

    show() {
        this.dialog.classList.remove('hidden');
    }

    hide() {
        this.dialog.classList.add('hidden');
    }
}

// Export singleton instance
export const permissionDialog = new PermissionDialog(); 