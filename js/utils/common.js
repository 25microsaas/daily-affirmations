// Common Utilities Module

// Debounce function
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Safe DOM query with error handling
export function safeQuerySelector(selector, context = document) {
    try {
        return context.querySelector(selector);
    } catch (error) {
        console.error(`Invalid selector: ${selector}`, error);
        return null;
    }
}

// Safe DOM query all with error handling
export function safeQuerySelectorAll(selector, context = document) {
    try {
        return Array.from(context.querySelectorAll(selector));
    } catch (error) {
        console.error(`Invalid selector: ${selector}`, error);
        return [];
    }
}

// Create element with attributes and children
export function createElement(tag, attributes = {}, children = []) {
    try {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Append children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    } catch (error) {
        console.error(`Failed to create element: ${tag}`, error);
        return null;
    }
}

// Show notification
export function showNotification(title, message, duration = 3000) {
    const notification = createElement('div', 
        { 
            className: 'notification glass',
            style: {
                opacity: '0',
                transform: 'translateX(120%)'
            }
        },
        [
            createElement('div', 
                { className: 'notification-content' },
                [
                    createElement('h4', {}, [title]),
                    createElement('p', {}, [message])
                ]
            )
        ]
    );

    if (!notification) return;

    document.body.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    });

    // Remove after duration
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(120%)';
        
        // Remove from DOM after animation
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Format date/time
export function formatDateTime(date = new Date()) {
    try {
        return {
            time: date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit'
            }),
            date: date.toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
            })
        };
    } catch (error) {
        console.error('Failed to format date/time:', error);
        return {
            time: '--:--',
            date: 'Date unavailable'
        };
    }
}

// Make element draggable
export function makeDraggable(element, options = {}) {
    if (!element) return null;

    const {
        handle = element,
        onDragStart,
        onDrag,
        onDragEnd,
        bounds = 'parent'
    } = options;

    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    const dragStart = (e) => {
        if (e.target !== handle) return;

        if (e.type === 'touchstart') {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }

        isDragging = true;
        onDragStart?.(e, { x: xOffset, y: yOffset });
    };

    const drag = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        if (e.type === 'touchmove') {
            currentX = e.touches[0].clientX - initialX;
            currentY = e.touches[0].clientY - initialY;
        } else {
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
        }

        // Apply bounds
        if (bounds === 'parent' && element.parentElement) {
            const parent = element.parentElement.getBoundingClientRect();
            const elem = element.getBoundingClientRect();

            currentX = Math.min(Math.max(currentX, 0), parent.width - elem.width);
            currentY = Math.min(Math.max(currentY, 0), parent.height - elem.height);
        }

        xOffset = currentX;
        yOffset = currentY;

        element.style.transform = `translate(${currentX}px, ${currentY}px)`;
        onDrag?.(e, { x: currentX, y: currentY });
    };

    const dragEnd = (e) => {
        if (!isDragging) return;
        
        initialX = currentX;
        initialY = currentY;
        isDragging = false;

        onDragEnd?.(e, { x: currentX, y: currentY });
    };

    // Add event listeners
    handle.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    handle.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);

    // Return cleanup function
    return () => {
        handle.removeEventListener('mousedown', dragStart);
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', dragEnd);
        handle.removeEventListener('touchstart', dragStart);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', dragEnd);
    };
}

// Animation utilities
export const animations = {
    timeouts: new Set(),
    intervals: new Set(),
    
    setTimeout(callback, delay) {
        const id = setTimeout(() => {
            this.timeouts.delete(id);
            callback();
        }, delay);
        this.timeouts.add(id);
        return id;
    },
    
    setInterval(callback, delay) {
        const id = setInterval(callback, delay);
        this.intervals.add(id);
        return id;
    },
    
    clearTimeout(id) {
        clearTimeout(id);
        this.timeouts.delete(id);
    },
    
    clearInterval(id) {
        clearInterval(id);
        this.intervals.delete(id);
    },
    
    clearAll() {
        this.timeouts.forEach(clearTimeout);
        this.intervals.forEach(clearInterval);
        this.timeouts.clear();
        this.intervals.clear();
    }
};

// Error boundary HOF
export function withErrorBoundary(func, fallback) {
    return async (...args) => {
        try {
            return await func(...args);
        } catch (error) {
            console.error('Error in function:', error);
            return typeof fallback === 'function' ? fallback(error) : fallback;
        }
    };
}

// Local storage wrapper with error handling
export const storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Failed to get item from storage: ${key}`, error);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Failed to set item in storage: ${key}`, error);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Failed to remove item from storage: ${key}`, error);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear storage', error);
            return false;
        }
    }
}; 