// js/services/todo.js

const TODO_STORAGE_KEY = 'extension_todos';

async function getTodos() {
    try {
        const result = await chrome.storage.local.get([TODO_STORAGE_KEY]);
        return result[TODO_STORAGE_KEY] || [];
    } catch (error) {
        console.error('Error fetching todos:', error);
        return [];
    }
}

async function saveTodos(todos) {
    try {
        await chrome.storage.local.set({ [TODO_STORAGE_KEY]: todos });
    } catch (error) {
        console.error('Error saving todos:', error);
    }
}

async function addTodo(todoText) {
    if (!todoText || typeof todoText !== 'string' || todoText.trim() === '') {
        console.warn('Attempted to add an empty or invalid todo item.');
        return false;
    }
    try {
        const todos = await getTodos();
        const newTodo = {
            id: `todo_${new Date().getTime()}`, // Simple unique ID
            text: todoText.trim(),
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        todos.push(newTodo);
        await saveTodos(todos);
        return newTodo;
    } catch (error) {
        console.error('Error adding todo:', error);
        return false;
    }
}

async function updateTodoText(todoId, updatedText) {
    if (!todoId || !updatedText || typeof updatedText !== 'string' || updatedText.trim() === '') {
        console.warn('Attempted to update todo with empty or invalid text.');
        return false;
    }
    try {
        const todos = await getTodos();
        const todoIndex = todos.findIndex(todo => todo.id === todoId);
        if (todoIndex === -1) {
            console.warn('Todo not found for text update:', todoId);
            return false;
        }
        todos[todoIndex].text = updatedText.trim();
        todos[todoIndex].updatedAt = new Date().toISOString();
        await saveTodos(todos);
        return todos[todoIndex];
    } catch (error) {
        console.error('Error updating todo text:', error);
        return false;
    }
}

async function toggleTodoStatus(todoId) {
    if (!todoId) {
        console.warn('Attempted to toggle todo status with no ID.');
        return false;
    }
    try {
        const todos = await getTodos();
        const todoIndex = todos.findIndex(todo => todo.id === todoId);
        if (todoIndex === -1) {
            console.warn('Todo not found for status toggle:', todoId);
            return false;
        }
        todos[todoIndex].completed = !todos[todoIndex].completed;
        todos[todoIndex].updatedAt = new Date().toISOString();
        await saveTodos(todos);
        return todos[todoIndex];
    } catch (error) {
        console.error('Error toggling todo status:', error);
        return false;
    }
}

async function deleteTodo(todoId) {
    if (!todoId) {
        console.warn('Attempted to delete todo with no ID.');
        return false;
    }
    try {
        let todos = await getTodos();
        const initialLength = todos.length;
        todos = todos.filter(todo => todo.id !== todoId);
        if (todos.length === initialLength) {
            console.warn('Todo not found for deletion:', todoId);
            return false;
        }
        await saveTodos(todos);
        return true;
    } catch (error) {
        console.error('Error deleting todo:', error);
        return false;
    }
}

async function clearCompletedTodos() {
    try {
        let todos = await getTodos();
        const initialLength = todos.length;
        todos = todos.filter(todo => !todo.completed);
        if (todos.length === initialLength) {
            console.log('No completed todos to clear.');
            return false; // Or indicate nothing was cleared
        }
        await saveTodos(todos);
        return true;
    } catch (error) {
        console.error('Error clearing completed todos:', error);
        return false;
    }
}


// Basic initialization logic
function initializeTodoService() {
    console.log('Todo service initialized.');
}

export default {
    initialize: initializeTodoService,
    getTodos,
    addTodo,
    updateTodoText,
    toggleTodoStatus,
    deleteTodo,
    clearCompletedTodos,
    // saveTodos can be exported if direct manipulation is needed
};
