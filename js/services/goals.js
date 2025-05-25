// js/services/goals.js

const GOALS_STORAGE_KEY = 'extension_goals';

// --- Internal State ---
let goals = []; // In-memory cache of goals

// --- Persistence ---
async function _loadGoalsFromStorage() {
    try {
        const result = await chrome.storage.local.get([GOALS_STORAGE_KEY]);
        goals = result[GOALS_STORAGE_KEY] || [];
    } catch (error) {
        console.error('Error loading goals from storage:', error);
        goals = [];
    }
}

async function _saveGoalsToStorage() {
    try {
        await chrome.storage.local.set({ [GOALS_STORAGE_KEY]: goals });
    } catch (error) {
        console.error('Error saving goals to storage:', error);
    }
}

// --- Public API ---
async function initialize() {
    await _loadGoalsFromStorage();
    console.log('Goals service initialized.');
}

function getGoals() {
    return [...goals]; // Return a copy to prevent direct modification
}

async function addGoal(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn('Attempted to add an empty or invalid goal.');
        return null;
    }
    const newGoal = {
        id: `goal_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`, // More robust unique ID
        text: text.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
    };
    goals.push(newGoal);
    await _saveGoalsToStorage();
    return { ...newGoal }; // Return a copy
}

async function updateGoalText(goalId, newText) {
    if (!newText || typeof newText !== 'string' || newText.trim() === '') {
        console.warn('Attempted to update goal with empty or invalid text.');
        return false;
    }
    const goalIndex = goals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) {
        console.warn('Goal not found for text update:', goalId);
        return false;
    }
    goals[goalIndex].text = newText.trim();
    await _saveGoalsToStorage();
    return true;
}

async function toggleGoalCompletion(goalId) {
    const goalIndex = goals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) {
        console.warn('Goal not found for completion toggle:', goalId);
        return false;
    }
    goals[goalIndex].completed = !goals[goalIndex].completed;
    await _saveGoalsToStorage();
    return true;
}

async function deleteGoal(goalId) {
    const initialLength = goals.length;
    goals = goals.filter(g => g.id !== goalId);
    if (goals.length === initialLength) {
        console.warn('Goal not found for deletion:', goalId);
        return false;
    }
    await _saveGoalsToStorage();
    return true;
}

async function reorderGoals(orderedGoalIds) {
    const newOrderedGoals = [];
    for (const id of orderedGoalIds) {
        const goal = goals.find(g => g.id === id);
        if (goal) {
            newOrderedGoals.push(goal);
        }
    }
    // Check if all original goals are still present
    if (newOrderedGoals.length === goals.length) {
        goals = newOrderedGoals;
        await _saveGoalsToStorage();
        return true;
    }
    console.warn('Reorder goals failed due to mismatched items.');
    return false;
}


export default {
    initialize,
    getGoals,
    addGoal,
    updateGoalText,
    toggleGoalCompletion,
    deleteGoal,
    reorderGoals, // Added for potential drag-and-drop reordering of goals in the list
};
