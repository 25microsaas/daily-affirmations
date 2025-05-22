// js/services/notes.js

const NOTES_STORAGE_KEY = 'extension_notes';

async function getNotes() {
    try {
        const result = await chrome.storage.local.get([NOTES_STORAGE_KEY]);
        return result[NOTES_STORAGE_KEY] || [];
    } catch (error) {
        console.error('Error fetching notes:', error);
        return [];
    }
}

async function saveNotes(notes) {
    try {
        await chrome.storage.local.set({ [NOTES_STORAGE_KEY]: notes });
    } catch (error) {
        console.error('Error saving notes:', error);
    }
}

async function addNote(noteContent) {
    if (!noteContent || typeof noteContent !== 'string' || noteContent.trim() === '') {
        console.warn('Attempted to add an empty or invalid note.');
        return false;
    }
    try {
        const notes = await getNotes();
        const newNote = {
            id: `note_${new Date().getTime()}`, // Simple unique ID
            content: noteContent.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        notes.push(newNote);
        await saveNotes(notes);
        return newNote;
    } catch (error) {
        console.error('Error adding note:', error);
        return false;
    }
}

async function updateNote(noteId, updatedContent) {
    if (!noteId || !updatedContent || typeof updatedContent !== 'string' || updatedContent.trim() === '') {
        console.warn('Attempted to update with empty or invalid content.');
        return false;
    }
    try {
        const notes = await getNotes();
        const noteIndex = notes.findIndex(note => note.id === noteId);
        if (noteIndex === -1) {
            console.warn('Note not found for update:', noteId);
            return false;
        }
        notes[noteIndex].content = updatedContent.trim();
        notes[noteIndex].updatedAt = new Date().toISOString();
        await saveNotes(notes);
        return notes[noteIndex];
    } catch (error) {
        console.error('Error updating note:', error);
        return false;
    }
}

async function deleteNote(noteId) {
    if (!noteId) {
        console.warn('Attempted to delete note with no ID.');
        return false;
    }
    try {
        let notes = await getNotes();
        const initialLength = notes.length;
        notes = notes.filter(note => note.id !== noteId);
        if (notes.length === initialLength) {
            console.warn('Note not found for deletion:', noteId);
            return false;
        }
        await saveNotes(notes);
        return true;
    } catch (error) {
        console.error('Error deleting note:', error);
        return false;
    }
}

// Basic initialization logic (optional, can be expanded)
function initializeNotesService() {
    // Could add listeners for storage changes if needed elsewhere
    console.log('Notes service initialized.');
}

export default {
    initialize: initializeNotesService,
    getNotes,
    addNote,
    updateNote,
    deleteNote,
    // saveNotes can be exported if direct manipulation is needed, but typically not
};
