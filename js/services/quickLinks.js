// js/services/quickLinks.js

const QUICK_LINKS_STORAGE_KEY = 'extension_quick_links';

// --- Internal State ---
let links = []; // In-memory cache of link objects {id, title, url, iconUrl}

// --- Favicon Service ---
// Uses Google's S2 service. sz=64 for potentially better resolution if available.
function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
        console.warn('Invalid URL for favicon:', url, e);
        return 'images/icon-32.png'; // Fallback to a default local icon
    }
}

// --- Persistence ---
async function _loadLinksFromStorage() {
    try {
        const result = await chrome.storage.local.get([QUICK_LINKS_STORAGE_KEY]);
        links = result[QUICK_LINKS_STORAGE_KEY] || [];
    } catch (error) {
        console.error('Error loading quick links from storage:', error);
        links = [];
    }
}

async function _saveLinksToStorage() {
    try {
        await chrome.storage.local.set({ [QUICK_LINKS_STORAGE_KEY]: links });
    } catch (error) {
        console.error('Error saving quick links to storage:', error);
    }
}

// --- Public API ---
async function initialize() {
    await _loadLinksFromStorage();
    console.log('Quick Links service initialized.');
}

function getLinks() {
    return [...links]; // Return a copy
}

async function addLink({ title, url }) {
    if (!title || typeof title !== 'string' || title.trim() === '' ||
        !url || typeof url !== 'string' || url.trim() === '') {
        console.warn('Attempted to add an invalid link (empty title or URL).');
        return null;
    }

    let newUrl = url.trim();
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        newUrl = 'https://' + newUrl; // Default to https
    }

    const newLink = {
        id: `link_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`,
        title: title.trim(),
        url: newUrl,
        iconUrl: getFaviconUrl(newUrl), // Generate favicon URL
    };
    links.push(newLink);
    await _saveLinksToStorage();
    return { ...newLink }; // Return a copy
}

async function updateLink({ id, title, url }) {
    if (!id || !title || typeof title !== 'string' || title.trim() === '' ||
        !url || typeof url !== 'string' || url.trim() === '') {
        console.warn('Attempted to update with invalid link data.');
        return false;
    }

    const linkIndex = links.findIndex(l => l.id === id);
    if (linkIndex === -1) {
        console.warn('Link not found for update:', id);
        return false;
    }

    let newUrl = url.trim();
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        newUrl = 'https://' + newUrl;
    }

    links[linkIndex].title = title.trim();
    // Only update icon if URL changes significantly (domain might change)
    if (links[linkIndex].url !== newUrl) {
        links[linkIndex].url = newUrl;
        links[linkIndex].iconUrl = getFaviconUrl(newUrl);
    }
    
    await _saveLinksToStorage();
    return { ...links[linkIndex] }; // Return updated link
}

async function deleteLink(linkId) {
    const initialLength = links.length;
    links = links.filter(l => l.id !== linkId);
    if (links.length === initialLength) {
        console.warn('Link not found for deletion:', linkId);
        return false;
    }
    await _saveLinksToStorage();
    return true;
}

async function reorderLinks(orderedLinkIds) {
    const newOrderedLinks = [];
    for (const id of orderedLinkIds) {
        const link = links.find(l => l.id === id);
        if (link) {
            newOrderedLinks.push(link);
        }
    }
    // Check if all original links are still present
    if (newOrderedLinks.length === links.length) {
        links = newOrderedLinks;
        await _saveLinksToStorage();
        return true;
    }
    console.warn('Reorder links failed due to mismatched items.');
    return false;
}

// Helper function to suggest a title from a URL (basic implementation)
// This is a simplified version. A real implementation might fetch the page
// and parse the <title> tag, which is complex and requires permissions/CORS.
// For now, we'll just format the domain.
function suggestTitleFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        let suggestedTitle = parsedUrl.hostname;
        // Remove www.
        suggestedTitle = suggestedTitle.replace(/^www\./i, '');
        // Capitalize first letter of parts
        suggestedTitle = suggestedTitle.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ').replace(/\s(Com|Net|Org|Co|Uk|De|Ca)$/i, ''); // Remove common TLDs from display name
        return suggestedTitle;
    } catch (e) {
        return '';
    }
}


export default {
    initialize,
    getLinks,
    addLink,
    updateLink,
    deleteLink,
    reorderLinks,
    getFaviconUrl, // Expose if needed by UI directly for URL changes
    suggestTitleFromUrl, // Expose for pre-filling title in modal
};
