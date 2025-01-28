export function showNotification(title, message, duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification glass';
    notification.innerHTML = `
        <h4>${title}</h4>
        <p>${message}</p>
    `;

    // Add to document
    document.body.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });

    // Remove after duration
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(10px)';
        
        // Remove from DOM after animation
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
} 