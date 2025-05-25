// js/services/habits.js

const HABITS_STORAGE_KEY = 'extension_habits'; // Stores the list of habit objects {id, text}
const HABIT_COMPLETIONS_STORAGE_KEY = 'extension_habit_completions'; // Stores {habitId: 'YYYY-MM-DD'}

// --- Internal State ---
let habits = []; // Array of {id: string, text: string}
let completions = {}; // Object mapping habitId to 'YYYY-MM-DD' string of last completion

// Function to get today's date as YYYY-MM-DD string
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Persistence ---
async function _loadDataFromStorage() {
    try {
        const result = await chrome.storage.local.get([HABITS_STORAGE_KEY, HABIT_COMPLETIONS_STORAGE_KEY]);
        habits = result[HABITS_STORAGE_KEY] || [];
        completions = result[HABIT_COMPLETIONS_STORAGE_KEY] || {};
    } catch (error) {
        console.error('Error loading habits data from storage:', error);
        habits = [];
        completions = {};
    }
}

async function _saveHabitsToStorage() {
    try {
        await chrome.storage.local.set({ [HABITS_STORAGE_KEY]: habits });
    } catch (error) {
        console.error('Error saving habits to storage:', error);
    }
}

async function _saveCompletionsToStorage() {
    try {
        await chrome.storage.local.set({ [HABIT_COMPLETIONS_STORAGE_KEY]: completions });
    } catch (error) {
        console.error('Error saving habit completions to storage:', error);
    }
}

// --- Daily Reset Logic ---
// This function is not strictly necessary if we check date strings on get.
// However, it can be used for cleanup if completions grow very large over time,
// or if we want to explicitly mark habits as 'not done' at the start of a day.
// For now, the "done today" status is derived dynamically in getHabitsWithCompletionStatus.

// --- Public API ---
async function initialize() {
    await _loadDataFromStorage();
    // Daily reset logic isn't strictly needed here if `getHabitsWithCompletionStatus` dynamically checks dates.
    // If we wanted to clean up old completion dates not relevant anymore (e.g. older than yesterday)
    // this would be the place. For now, we keep all completion records.
    console.log('Habits service initialized.');
}

// Returns habits with an added 'doneToday' boolean property
function getHabitsWithCompletionStatus() {
    const todayStr = getTodayDateString();
    return habits.map(habit => ({
        ...habit,
        doneToday: completions[habit.id] === todayStr,
    }));
}

async function addHabit(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn('Attempted to add an empty or invalid habit.');
        return null;
    }
    const newHabit = {
        id: `habit_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`,
        text: text.trim(),
    };
    habits.push(newHabit);
    await _saveHabitsToStorage();
    return { ...newHabit, doneToday: false }; // Return with initial completion status
}

async function toggleHabitDoneToday(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) {
        console.warn('Habit not found for toggling completion:', habitId);
        return false;
    }

    const todayStr = getTodayDateString();
    if (completions[habitId] === todayStr) {
        // It was done today, so mark as not done (remove completion entry for today)
        delete completions[habitId];
    } else {
        // Mark as done for today
        completions[habitId] = todayStr;
    }
    await _saveCompletionsToStorage();
    return true;
}

async function deleteHabit(habitId) {
    const initialLength = habits.length;
    habits = habits.filter(h => h.id !== habitId);

    if (habits.length === initialLength) {
        console.warn('Habit not found for deletion:', habitId);
        return false;
    }

    // Also remove its completion data
    if (completions[habitId]) {
        delete completions[habitId];
        await _saveCompletionsToStorage(); // Save completions if a deleted habit had one
    }
    await _saveHabitsToStorage(); // Save the modified habits array
    return true;
}

export default {
    initialize,
    getHabitsWithCompletionStatus,
    addHabit,
    toggleHabitDoneToday,
    deleteHabit,
};
