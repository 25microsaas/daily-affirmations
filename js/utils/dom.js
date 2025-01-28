// DOM Utility Functions

/**
 * Create an HTML element with specified attributes and styles
 * @param {string} tag - HTML tag name
 * @param {Object} options - Element options
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    
    // Set className
    if (options.className) {
        element.className = options.className;
    }

    // Set textContent
    if (options.textContent !== undefined) {
        element.textContent = options.textContent;
    }

    // Set innerHTML
    if (options.innerHTML !== undefined) {
        element.innerHTML = options.innerHTML;
    }

    // Set styles
    if (options.style) {
        Object.assign(element.style, options.style);
    }

    // Set attributes
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    // Set dataset
    if (options.dataset) {
        Object.entries(options.dataset).forEach(([key, value]) => {
            element.dataset[key] = value;
        });
    }

    // Set event listeners
    if (options.events) {
        Object.entries(options.events).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
        });
    }

    // Set onclick
    if (options.onclick) {
        element.onclick = options.onclick;
    }

    return element;
}

/**
 * Remove all child nodes from an element
 * @param {HTMLElement} element - Element to clear
 */
export function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Add or remove a class based on condition
 * @param {HTMLElement} element - Target element
 * @param {string} className - Class to toggle
 * @param {boolean} condition - Whether to add or remove
 */
export function toggleClass(element, className, condition) {
    if (condition) {
        element.classList.add(className);
    } else {
        element.classList.remove(className);
    }
}

/**
 * Create a debounced version of a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
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

/**
 * Add ripple effect to element
 * @param {HTMLElement} element - Element to add ripple to
 */
export function addRippleEffect(element) {
    element.addEventListener('click', (e) => {
        const ripple = createElement('span', {
            className: 'ripple',
            style: {
                position: 'absolute',
                borderRadius: '50%',
                transform: 'scale(0)',
                animation: 'ripple 600ms linear',
                backgroundColor: 'rgba(255, 255, 255, 0.7)'
            }
        });

        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    });
}

/**
 * Create a tooltip element
 * @param {string} text - Tooltip text
 * @param {Object} options - Tooltip options
 * @returns {HTMLElement}
 */
export function createTooltip(text, options = {}) {
    return createElement('div', {
        className: 'tooltip',
        textContent: text,
        style: {
            position: 'absolute',
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#ffffff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: '10000',
            pointerEvents: 'none',
            ...options.style
        }
    });
}

/**
 * Add tooltip to element
 * @param {HTMLElement} element - Element to add tooltip to
 * @param {string} text - Tooltip text
 * @param {Object} options - Tooltip options
 */
export function addTooltip(element, text, options = {}) {
    let tooltip = null;
    const showDelay = options.delay || 200;
    let timeout;

    element.addEventListener('mouseenter', () => {
        timeout = setTimeout(() => {
            tooltip = createTooltip(text, options);
            document.body.appendChild(tooltip);

            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            let top = rect.top - tooltipRect.height - 8;
            let left = rect.left + (rect.width - tooltipRect.width) / 2;

            if (top < 0) {
                top = rect.bottom + 8;
            }

            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        }, showDelay);
    });

    element.addEventListener('mouseleave', () => {
        clearTimeout(timeout);
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }
    });
} 