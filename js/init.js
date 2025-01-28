// Service Worker Registration and Offline Status Handler
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('js/sw.js')
        .then(registration => {
            console.log('ServiceWorker registered:', registration);
        })
        .catch(error => {
            console.error('ServiceWorker registration failed:', error);
        });
}

// Handle offline/online events
window.addEventListener('online', () => {
    document.body.classList.remove('offline');
    const offlineMessage = document.querySelector('.offline-message');
    if (offlineMessage) {
        offlineMessage.classList.add('hidden');
    }
});

window.addEventListener('offline', () => {
    document.body.classList.add('offline');
    const offlineMessage = document.querySelector('.offline-message');
    if (offlineMessage) {
        offlineMessage.classList.remove('hidden');
    }
});

// Initial offline check
if (!navigator.onLine) {
    document.body.classList.add('offline');
    const offlineMessage = document.querySelector('.offline-message');
    if (offlineMessage) {
        offlineMessage.classList.remove('hidden');
    }
} 