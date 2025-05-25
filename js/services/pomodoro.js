// js/services/pomodoro.js

const POMODORO_SETTINGS_KEY = 'pomodoro_settings';
const POMODORO_STATE_KEY = 'pomodoro_current_state';

const defaults = {
    workDuration: 25 * 60, // seconds
    shortBreakDuration: 5 * 60,
    longBreakDuration: 15 * 60,
    cyclesBeforeLongBreak: 4,
    soundEnabled: true,
};

let settings = { ...defaults };
let currentState = {
    timerId: null,
    currentMode: 'work', // 'work', 'shortBreak', 'longBreak'
    remainingTime: defaults.workDuration,
    currentCycle: 1,
    isRunning: false,
    pausedTime: 0, // To store Date.now() when paused
};

// --- Dependencies (will be set via initialize) ---
let stateManager; // To save settings persistently if changed via UI
let appRef; // To update UI elements directly

// --- Internal Timer Logic ---
function _tick() {
    if (currentState.remainingTime <= 0) {
        _handleStateCompletion();
    } else {
        currentState.remainingTime--;
        _updateUIDisplay();
    }
}

function _startTimerInterval() {
    if (currentState.timerId) clearInterval(currentState.timerId);
    currentState.timerId = setInterval(_tick, 1000);
    currentState.isRunning = true;
    _updateUIDisplay(); // Reflect start/pause button state
}

function _pauseTimerInterval() {
    if (currentState.timerId) {
        clearInterval(currentState.timerId);
        currentState.timerId = null;
    }
    currentState.isRunning = false;
    currentState.pausedTime = Date.now(); // Store time when paused
    _updateUIDisplay(); // Reflect start/pause button state
    _saveCurrentState(); // Save state on pause
}

async function _handleStateCompletion() {
    _pauseTimerInterval(); // Stop timer first

    // Notifications
    const previousMode = currentState.currentMode;
    let notificationMessage = '';

    if (settings.soundEnabled) {
        // Simple beep sound - can be replaced with a file if available
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Volume
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5); // Beep for 0.5s
    }

    // Desktop Notification
    let newModeDisplay = '';
    if (previousMode === 'work') {
        if (currentState.currentCycle >= settings.cyclesBeforeLongBreak) {
            notificationMessage = "Work session complete! Time for a long break.";
            currentState.currentMode = 'longBreak';
            currentState.remainingTime = settings.longBreakDuration;
            newModeDisplay = 'Long Break';
        } else {
            notificationMessage = "Work session complete! Time for a short break.";
            currentState.currentMode = 'shortBreak';
            currentState.remainingTime = settings.shortBreakDuration;
            newModeDisplay = 'Short Break';
        }
    } else { // End of a break
        notificationMessage = `${previousMode === 'shortBreak' ? 'Short' : 'Long'} break is over! Time for work.`;
        currentState.currentMode = 'work';
        currentState.remainingTime = settings.workDuration;
        if (previousMode === 'longBreak') {
            currentState.currentCycle = 1; // Reset cycle after long break
        } else {
            currentState.currentCycle++;
        }
        newModeDisplay = 'Work';
    }

    try {
        await chrome.notifications.create(`pomodoro_notification_${Date.now()}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('images/icon-128.png'), // Ensure this path is correct
            title: 'Focus Timer',
            message: notificationMessage,
            priority: 2,
            buttons: [{ title: 'Start Next' }] // User can click this to auto-start
        });
    } catch (e) {
        console.error("Error creating notification:", e);
    }


    _updateUIDisplay();
    _saveCurrentState();

    // Auto-start next state can be an option later
    // For now, user clicks start manually or via notification button
}

// --- UI Update Abstraction ---
function _updateUIDisplay() {
    if (appRef && typeof appRef.updatePomodoroUI === 'function') {
        appRef.updatePomodoroUI({
            mode: currentState.currentMode,
            time: currentState.remainingTime,
            cycle: currentState.currentCycle,
            isRunning: currentState.isRunning,
            cyclesBeforeLongBreak: settings.cyclesBeforeLongBreak
        });
    }
}

// --- Persistence ---
async function _loadSettings() {
    if (stateManager) { // If stateManager is available (full app context)
        const savedGlobalSettings = await stateManager.getSettings();
        if (savedGlobalSettings && savedGlobalSettings.pomodoro) {
            settings = { ...defaults, ...savedGlobalSettings.pomodoro };
        }
    } else { // Fallback to direct storage if service used standalone (less likely for this extension)
        const result = await chrome.storage.local.get([POMODORO_SETTINGS_KEY]);
        if (result[POMODORO_SETTINGS_KEY]) {
            settings = { ...defaults, ...result[POMODORO_SETTINGS_KEY] };
        }
    }
    // Apply loaded settings to current state if necessary (e.g., if timer was not running)
    if (!currentState.isRunning) {
        if (currentState.currentMode === 'work') currentState.remainingTime = settings.workDuration;
        else if (currentState.currentMode === 'shortBreak') currentState.remainingTime = settings.shortBreakDuration;
        else if (currentState.currentMode === 'longBreak') currentState.remainingTime = settings.longBreakDuration;
    }
}

async function _saveCurrentState() {
    // Save only non-sensitive parts of current state (not timerId)
    const stateToSave = {
        currentMode: currentState.currentMode,
        remainingTime: currentState.remainingTime,
        currentCycle: currentState.currentCycle,
        isRunning: currentState.isRunning,
        // pausedTime is transient, used to calculate elapsed time if needed on resume for high accuracy
        // but for simple second countdown, remainingTime is enough.
    };
    await chrome.storage.local.set({ [POMODORO_STATE_KEY]: stateToSave });
}

async function _loadSavedState() {
    const result = await chrome.storage.local.get([POMODORO_STATE_KEY]);
    if (result[POMODORO_STATE_KEY]) {
        const saved = result[POMODORO_STATE_KEY];
        currentState.currentMode = saved.currentMode || 'work';
        currentState.remainingTime = saved.remainingTime || settings.workDuration;
        currentState.currentCycle = saved.currentCycle || 1;
        // Do not automatically restart if it was running; user should explicitly start.
        // If it was running and page reloaded, it will appear paused.
        currentState.isRunning = false; // Always start in a paused state on load
    }
}


// --- Public API ---
async function initialize(app, sm) {
    appRef = app;
    stateManager = sm; // Assuming stateManager is passed for settings
    await _loadSettings();
    await _loadSavedState();
    _updateUIDisplay();

    // Listener for notification button click
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
        if (notificationId.startsWith('pomodoro_notification_') && buttonIndex === 0) {
            // "Start Next" button clicked
            api.startPause(); // This will start the new state
            chrome.notifications.clear(notificationId);
        }
    });
    console.log('Pomodoro service initialized.');
}

function startPause() {
    if (currentState.isRunning) {
        _pauseTimerInterval();
    } else {
        // If resuming from a paused state where significant time might have passed (e.g., PC sleep)
        // A more robust handling would calculate time elapsed since currentState.pausedTime.
        // For simplicity, we assume tick handles it or it's a fresh start.
        _startTimerInterval();
    }
    _saveCurrentState(); // Save running state
}

function reset() {
    _pauseTimerInterval();
    currentState.currentMode = 'work';
    currentState.remainingTime = settings.workDuration;
    currentState.currentCycle = 1;
    currentState.isRunning = false;
    _updateUIDisplay();
    _saveCurrentState();
}

function skip() {
    _pauseTimerInterval(); // Stop current
    _handleStateCompletion(); // This will transition to the next state
    // Do not auto-start; user should click start or the notification button
}

async function updateSettings(newSettings) {
    const oldSettings = { ...settings };
    settings = { ...settings, ...newSettings };

    // Persist these settings using stateManager if available
    if (stateManager) {
        await stateManager.updateSettings({ pomodoro: settings });
    } else { // Fallback for standalone use
        await chrome.storage.local.set({ [POMODORO_SETTINGS_KEY]: settings });
    }

    // If timer is not running, adjust current state's remaining time based on new duration
    if (!currentState.isRunning) {
        let durationChanged = false;
        if (currentState.currentMode === 'work' && settings.workDuration !== oldSettings.workDuration) {
            currentState.remainingTime = settings.workDuration;
            durationChanged = true;
        } else if (currentState.currentMode === 'shortBreak' && settings.shortBreakDuration !== oldSettings.shortBreakDuration) {
            currentState.remainingTime = settings.shortBreakDuration;
            durationChanged = true;
        } else if (currentState.currentMode === 'longBreak' && settings.longBreakDuration !== oldSettings.longBreakDuration) {
            currentState.remainingTime = settings.longBreakDuration;
            durationChanged = true;
        }
        if(durationChanged){
            _updateUIDisplay();
            _saveCurrentState();
        }
    }
}

function getSettings() {
    return { ...settings };
}

const api = {
    initialize,
    startPause,
    reset,
    skip,
    updateSettings,
    getSettings
};

export default api;
