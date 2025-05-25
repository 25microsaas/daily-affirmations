// js/services/siteBlocker.js

const BLOCKED_HOSTNAMES_KEY = 'siteblocker_hostnames';
const BLOCKER_ENABLED_KEY = 'siteblocker_enabled';
const RULE_ID_PREFIX = 'block_host_'; // Prefix for declarativeNetRequest rule IDs
let isListenerRegistered = false; // To prevent multiple registrations of onRuleMatchedDebug

// --- Internal State ---
let blockedHostnames = []; // Array of strings, e.g., ["example.com", "another.org"]
let isBlockingEnabled = false;

// --- Declarative Net Request API Helpers ---

// Function to get the URL for the blocked page
function getBlockedPageUrl() {
    return chrome.runtime.getURL('blocked.html');
}

// Updates all declarativeNetRequest rules based on the current blockedHostnames list and isBlockingEnabled state.
async function _updateBlockingRules() {
    const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = currentRules.map(rule => rule.id);
    const ruleIdsToRemove = existingRuleIds.filter(id => id.toString().startsWith(RULE_ID_PREFIX)); // Ensure ID is string for startsWith

    const rulesToAdd = [];
    if (isBlockingEnabled) {
        blockedHostnames.forEach((hostname, index) => {
            // Ensure hostname is just the domain, without scheme or path for declarativeNetRequest
            let cleanHostname = hostname.trim().toLowerCase();
            try {
                // Attempt to normalize, but primarily rely on user input format for hostnames
                const url = new URL('http://' + cleanHostname.replace(/^https?:\/\//, ''));
                cleanHostname = url.hostname;
            } catch (e) {
                console.warn(`Invalid hostname format for rule: ${hostname}, skipping.`);
                return; // Skip this hostname if it's malformed
            }

            if (cleanHostname) { // Ensure cleanHostname is not empty
                 rulesToAdd.push({
                    id: parseInt(RULE_ID_PREFIX.replace(/[^0-9]/g, '') || '1') * 10000 + index + 1000, // Generate unique numeric ID for rules
                    priority: 1,
                    action: {
                        type: 'redirect',
                        redirect: { url: getBlockedPageUrl() }
                    },
                    condition: {
                        // urlFilter: `||${cleanHostname}/`, // This blocks domain and subdomains
                        // Using requestDomains is often more straightforward for blocking entire domains
                        requestDomains: [cleanHostname],
                        resourceTypes: ['main_frame', 'sub_frame'] // Block top-level navigation and iframes
                    }
                });
            }
        });
    }
    
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ruleIdsToRemove,
            addRules: rulesToAdd
        });
        console.log('Blocking rules updated. Added:', rulesToAdd.length, 'Removed:', ruleIdsToRemove.length);
    } catch (error) {
        console.error('Error updating blocking rules:', error, 'Rules to add:', rulesToAdd, 'Rules to remove:', ruleIdsToRemove);
        // Potentially surface this error to the user if rules fail to update
    }
}


// --- Persistence ---
async function _loadStateFromStorage() {
    try {
        const result = await chrome.storage.local.get([BLOCKED_HOSTNAMES_KEY, BLOCKER_ENABLED_KEY]);
        blockedHostnames = result[BLOCKED_HOSTNAMES_KEY] || [];
        isBlockingEnabled = result[BLOCKER_ENABLED_KEY] || false;
    } catch (error) {
        console.error('Error loading site blocker state from storage:', error);
        blockedHostnames = [];
        isBlockingEnabled = false;
    }
}

async function _saveBlockedHostnames() {
    try {
        await chrome.storage.local.set({ [BLOCKED_HOSTNAMES_KEY]: blockedHostnames });
    } catch (error) {
        console.error('Error saving blocked hostnames:', error);
    }
}

async function _saveBlockerEnabledState() {
    try {
        await chrome.storage.local.set({ [BLOCKER_ENABLED_KEY]: isBlockingEnabled });
    } catch (error) {
        console.error('Error saving blocker enabled state:', error);
    }
}

// --- Public API ---
async function initialize() {
    await _loadStateFromStorage();
    await _updateBlockingRules(); // Apply rules based on loaded state

    // Optional: Debug listener for when rules are matched (requires declarativeNetRequestFeedback permission)
    // if (chrome.declarativeNetRequest.onRuleMatchedDebug && !isListenerRegistered) {
    //    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    //        console.log('Rule matched:', info);
    //    });
    //    isListenerRegistered = true;
    // }
    console.log('Site Blocker service initialized. Enabled:', isBlockingEnabled, 'Blocked:', blockedHostnames);
}

function getBlockedHostnames() {
    return [...blockedHostnames];
}

function getBlockerEnabledStatus() {
    return isBlockingEnabled;
}

async function addBlockedHostname(hostname) {
    const cleanHostname = hostname.trim().toLowerCase();
    if (!cleanHostname) {
        console.warn('Attempted to add an empty hostname.');
        return false;
    }
    if (!blockedHostnames.includes(cleanHostname)) {
        blockedHostnames.push(cleanHostname);
        await _saveBlockedHostnames();
        await _updateBlockingRules();
        return true;
    }
    console.warn('Hostname already in block list:', cleanHostname);
    return false; // Already exists
}

async function removeBlockedHostname(hostname) {
    const initialLength = blockedHostnames.length;
    blockedHostnames = blockedHostnames.filter(h => h !== hostname.trim().toLowerCase());
    if (blockedHostnames.length < initialLength) {
        await _saveBlockedHostnames();
        await _updateBlockingRules();
        return true;
    }
    return false; // Not found
}

async function setBlockerEnabled(enabled) {
    isBlockingEnabled = !!enabled; // Ensure boolean
    await _saveBlockerEnabledState();
    await _updateBlockingRules();
}

export default {
    initialize,
    getBlockedHostnames,
    getBlockerEnabledStatus,
    addBlockedHostname,
    removeBlockedHostname,
    setBlockerEnabled,
};
