// Service Worker Registration and Offline Status Handler

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
    handleOfflineCapability();

    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());

    gtag('config', 'G-FPQS70TC8X');
});

