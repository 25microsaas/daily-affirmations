// Service Worker Registration and Offline Status Handler
import { permissionDialog } from './components/permission-dialog.js';

// Check if permissions were previously granted
async function checkPermissions() {
    try {
        const { permissionsGranted } = await chrome.storage.local.get('permissionsGranted');
        
        if (permissionsGranted === undefined) {
            // First time user, show permission dialog
            permissionDialog.show();
        } else if (permissionsGranted) {
            // Permissions already granted, initialize service worker
            await permissionDialog.initializeServiceWorker();
        } else {
            // User previously declined, use basic features
            handleOfflineCapability();
        }
    } catch (error) {
        console.error('Failed to check permissions:', error);
        handleOfflineCapability();
    }
}

// Handle offline/online events
function handleOfflineCapability() {
    const updateOfflineStatus = () => {
        const isOffline = !navigator.onLine;
        document.body.classList.toggle('offline', isOffline);
        const offlineMessage = document.querySelector('.offline-message');
        if (offlineMessage) {
            offlineMessage.classList.toggle('hidden', !isOffline);
        }
    };

    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);
    
    // Initial check
    updateOfflineStatus();
}

// Initialize on page load
window.addEventListener('load', () => {
    checkPermissions().catch(error => {
        console.error('Initialization failed:', error);
        handleOfflineCapability();
    });
}); 