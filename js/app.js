// Main App Module
import stateManager from './modules/state.js';
import weatherService from './services/weather.js';
import backgroundService from './services/background.js';
import affirmationsService from './services/affirmations.js';
import premiumService from './services/premium.js';
import customAffirmationsService from './services/customAffirmations.js';
import dailyReminderService from './services/dailyReminder.js';
import notesService from './services/notes.js';
import todoService from './services/todo.js';
import reminderSettings from './components/reminder-settings.js';
import { animations, makeDraggable, showNotification } from './utils/common.js';
import { setupAffirmationActions } from './actions/affirmationActions.js';
import favoriteAffirmations from './components/favoriteAffirmations.js';
import { requirePremium } from './utils/premium.js';
import favoritesManager from './components/favorites-manager.js';
import savedBackgroundsManager from './components/saved-backgrounds.js';
import backupRestoreDialog from './components/backup-restore.js';

// API Keys management
async function getApiKeys() {
    try {
        // First check if we have cached keys in chrome.storage
        const cachedKeys = await chrome.storage.local.get(['unsplashKey', 'weatherKey']);
        
        if (cachedKeys.unsplashKey && cachedKeys.weatherKey) {
            return {
                unsplash: cachedKeys.unsplashKey,
                weather: cachedKeys.weatherKey
            };
        }

        // If no cached keys, fetch from your secure backend
        const response = await fetch('https://www.daily-affirmation.today/api/get-api-keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Add any authentication tokens if needed
            // credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch API keys');
        }

        const keys = await response.json();
        
        // Cache the keys
        await chrome.storage.local.set({
            unsplashKey: keys.unsplash,
            weatherKey: keys.weather
        });

        return keys;
    } catch (error) {
        console.error('Error fetching API keys:', error);
        throw error;
    }
}

class App {
    constructor() {
        this.initialized = false;
        this.cleanup = {
            draggable: new Set(),
            animations: animations
        };
    }

    // Initialize all services
    async initializeServices() {
        const serviceStatus = {
            state: false,
            weather: false,
            background: false,
            premium: false,
            affirmations: false,
            customAffirmations: false,
            dailyReminder: false,
            backup: false,
            notes: false,
            todo: false
        };

        try {
            // Initialize state first as other services depend on it
            await stateManager.loadState();
            serviceStatus.state = true;

            // Get API keys first
            const keys = await getApiKeys();
            if (!keys) {
                throw new Error('Failed to get API keys');
            }

            // Initialize services in parallel
            await Promise.all([
                // Weather service initialization
                weatherService.init(keys.weather)
                    .then(() => serviceStatus.weather = true)
                    .catch(error => {
                        console.error('Weather service initialization failed:', error);
                        return false;
                    }),

                // Background service initialization
                backgroundService.init(keys.unsplash)
                    .then(() => serviceStatus.background = true)
                    .catch(error => {
                        console.error('Background service initialization failed:', error);
                        return false;
                    }),

                // Premium service initialization
                premiumService.initialize()
                    .then(() => serviceStatus.premium = true)
                    .catch(error => {
                        console.error('Premium service initialization failed:', error);
                        return false;
                    }),

                // Custom Affirmations service initialization
                customAffirmationsService.init()
                    .then(() => serviceStatus.customAffirmations = true)
                    .catch(error => {
                        console.error('Custom Affirmations service initialization failed:', error);
                        return false;
                    }),

                // Daily Reminder service initialization
                dailyReminderService.init()
                    .then(() => serviceStatus.dailyReminder = true)
                    .catch(error => {
                        console.error('Daily Reminder service initialization failed:', error);
                        return false;
                    }),

                // Favorite Affirmations initialization
                favoriteAffirmations.initialize()
                    .then(() => serviceStatus.favoriteAffirmations = true)
                    .catch(error => {
                        console.error('Favorite Affirmations initialization failed:', error);
                        return false;
                    }),

                // Initialize backup service
                backupRestoreDialog.initialize()
                    .then(() => serviceStatus.backup = true)
                    .catch(error => {
                        console.error('Backup service initialization failed:', error);
                        return false;
                    }),

                // Notes service initialization
                notesService.initialize()
                    .then(() => serviceStatus.notes = true)
                    .catch(error => {
                        console.error('Notes service initialization failed:', error);
                        return false;
                    }),

                // Todo service initialization
                todoService.initialize()
                    .then(() => serviceStatus.todo = true)
                    .catch(error => {
                        console.error('Todo service initialization failed:', error);
                        return false;
                    }),
            ]);

            // Update services that successfully initialized
            const updatePromises = [];
            
            if (serviceStatus.weather) {
                updatePromises.push(
                    weatherService.update().catch(error => {
                        console.error('Weather update failed:', error);
                    })
                );
            }

            if (serviceStatus.background) {
                updatePromises.push(
                    backgroundService.update().catch(error => {
                        console.error('Background update failed:', error);
                    })
                );
            }

            // Affirmations don't require initialization
            updatePromises.push(
                affirmationsService.update().catch(error => {
                    console.error('Affirmations update failed:', error);
                })
            );

            await Promise.all(updatePromises);

            // Store service status for debugging
            this.serviceStatus = serviceStatus;

            // If any critical service failed, throw error
            if (!serviceStatus.state) {
                throw new Error('Critical service (state) failed to initialize');
            }

        } catch (error) {
            console.error('Service initialization failed:', error);
            this.handleInitializationError(error);
            throw error;
        }
    }

    // Render Notes
    async renderNotes() {
        const notes = await notesService.getNotes();
        const notesListContainer = document.querySelector('#notes-widget .notes-list-container');
        if (!notesListContainer) return;

        notesListContainer.innerHTML = ''; // Clear existing notes

        if (notes.length === 0) {
            notesListContainer.innerHTML = '<p class="empty-state-message">No notes yet. Add one below!</p>';
            return;
        }

        notes.forEach(note => {
            const noteElement = document.createElement('div');
            noteElement.className = 'note-item glass'; // Added glass for consistency
            noteElement.dataset.noteId = note.id;
            
            const noteContent = document.createElement('p');
            noteContent.textContent = note.content;
            // Allow editing directly in the future, for now, just display
            // noteContent.setAttribute('contenteditable', 'true'); 
            // noteContent.addEventListener('blur', (e) => {
            //    notesService.updateNote(note.id, e.target.textContent);
            // });

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '<i class="material-icons-round">delete</i>';
            deleteButton.title = 'Delete Note';
            deleteButton.addEventListener('click', async () => {
                await notesService.deleteNote(note.id);
                this.renderNotes(); // Re-render
            });

            noteElement.appendChild(noteContent);
            noteElement.appendChild(deleteButton);
            notesListContainer.appendChild(noteElement);
        });
    }

    // Render Todos
    async renderTodos() {
        const todos = await todoService.getTodos();
        const todoListElement = document.querySelector('#todo-widget .todo-list');
        if (!todoListElement) return;

        todoListElement.innerHTML = ''; // Clear existing todos

        if (todos.length === 0) {
            todoListElement.innerHTML = '<li class="empty-state-message">No todos yet. Add one above!</li>';
            return;
        }

        todos.forEach(todo => {
            const todoItem = document.createElement('li');
            todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            todoItem.dataset.todoId = todo.id;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'todo-checkbox';
            checkbox.checked = todo.completed;
            checkbox.addEventListener('change', async () => {
                await todoService.toggleTodoStatus(todo.id);
                this.renderTodos(); // Re-render
            });

            const textSpan = document.createElement('span');
            textSpan.className = 'todo-text';
            textSpan.textContent = todo.text;
            // Allow editing in the future
            // textSpan.setAttribute('contenteditable', 'true');
            // textSpan.addEventListener('blur', (e) => {
            //    todoService.updateTodoText(todo.id, e.target.textContent);
            // });


            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '<i class="material-icons-round">delete</i>';
            deleteButton.title = 'Delete Todo';
            deleteButton.addEventListener('click', async () => {
                await todoService.deleteTodo(todo.id);
                this.renderTodos(); // Re-render
            });
            
            todoItem.appendChild(checkbox);
            todoItem.appendChild(textSpan);
            todoItem.appendChild(deleteButton);
            todoListElement.appendChild(todoItem);
        });
    }

    // Initialize UI components
    async initializeUI() {
        try {
            const settings = stateManager.getSettings(); // Keep this for widgetPositions if needed elsewhere in initUI
            
            // Initial visibility for Notes & Todo is now handled in setupPanelInteractions
            // where their respective checkboxes are initialized.

            // Apply saved widget positions
            const { widgetPositions } = settings;
            if (widgetPositions) {
                for (const widgetStorageId in widgetPositions) {
                    const position = widgetPositions[widgetStorageId];
                    if (position && typeof position.top === 'string' && typeof position.left === 'string') {
                        const widgetElement = document.getElementById(`${widgetStorageId}-widget`);
                        if (widgetElement) {
                            widgetElement.style.top = position.top;
                            widgetElement.style.left = position.left;
                            // Ensure position is set to allow top/left to work. 
                            // .draggable-widget should already handle this, but being explicit can be safer.
                            widgetElement.style.position = 'fixed'; // Or 'absolute' if container is relative
                        }
                    }
                }
            }

            this.initializeDraggableWidgets();
            this.initializeTimeUpdate();
            await reminderSettings.initialize();
            this.setupEventListeners();
            this.setupPanelInteractions();
            setupAffirmationActions();
            this.renderNotes();
            this.renderTodos();
        } catch (error) {
            console.error('UI initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    // Initialize draggable widgets
    initializeDraggableWidgets() {
        const widgetSelectors = ['#weather-widget', '#time-widget', '#notes-widget', '#todo-widget', '#affirmation-widget']; // Added affirmation-widget
        
        widgetSelectors.forEach(selector => {
            const widgetElement = document.querySelector(selector);
            if (widgetElement && !widgetElement.classList.contains('hidden')) {
                const handle = widgetElement.querySelector('.widget-handle');
                if (handle) {
                    const cleanup = makeDraggable(widgetElement, {
                        handle: handle,
                        onDragEnd: async (element, position) => {
                            const widgetId = element.id;
                            if (!widgetId) {
                                console.warn('Draggable element is missing an ID:', element);
                                return;
                            }
                            const storageId = widgetId.replace('-widget', ''); // E.g., 'weather' from 'weather-widget'
                            
                            // Ensure currentSettings is loaded before trying to get widgetPositions
                            const currentSettings = stateManager.getSettings();
                            const currentWidgetPositions = currentSettings.widgetPositions || {};

                            await stateManager.updateSettings({
                                widgetPositions: {
                                    ...currentWidgetPositions,
                                    [storageId]: { top: `${position.y}px`, left: `${position.x}px` }
                                }
                            });
                        }
                    });
                    if (cleanup) this.cleanup.draggable.add(cleanup);
                } else {
                    console.warn(`No handle found for widget: ${selector}`);
                }
            } else if (widgetElement && widgetElement.classList.contains('hidden')) {
                // console.log(`Widget ${selector} is hidden, not making draggable yet.`);
                // Optionally, add logic here to re-initialize draggable if widget becomes visible.
                // For now, we rely on page reload or manual re-init if visibility changes.
            } else {
                console.warn(`Widget not found: ${selector}`);
            }
        });
    }

    // Initialize time updates
    initializeTimeUpdate() {
        const updateDateTime = () => {
            const now = new Date();
            const timeElement = document.querySelector('.time');
            const dateElement = document.querySelector('.date');
            const timeWidget = document.querySelector('.time-widget');
            const settings = stateManager.getSettings();

            if (timeWidget) {
                timeWidget.style.display = settings.showClock ? 'block' : 'none';
            }

            if (settings.showClock) {
                if (timeElement) {
                    timeElement.textContent = now.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit'
                    });
                }

                if (dateElement) {
                    dateElement.textContent = now.toLocaleDateString([], {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    });
                }
            }
        };

        // Update immediately and then every second
        updateDateTime();
        this.cleanup.animations.setInterval(updateDateTime, 1000);
    }

    // Setup event listeners
    setupEventListeners() {
        // Refresh button
        document.querySelector('.refresh-button')?.addEventListener('click', () => {
            affirmationsService.update();
        });

        // Focus mode button
        document.getElementById('focusModeButton')?.addEventListener('click', () => {
            this.toggleFocusMode();
        });

        // Favorites menu item
        document.querySelector('.favorite-affirmations-item')?.addEventListener('click', async () => {
            try {
                await requirePremium('favorite_affirmations', () => {
                    favoritesManager.show();
                });
            } catch (error) {
                if (error.message === 'Premium feature not available') {
                    showNotification('Premium Required', 'Upgrade to Pro to use favorite affirmations');
                } else {
                    console.error('Failed to show favorites manager:', error);
                    showNotification('Error', 'Failed to open favorites manager');
                }
            }
        });

        // Saved backgrounds menu item
        document.querySelector('#backgroundsButton')?.addEventListener('click', async () => {
            try {
                await requirePremium('saved_backgrounds', () => {
                    savedBackgroundsManager.show();
                });
            } catch (error) {
                if (error.message === 'Premium feature not available') {
                    showNotification('Premium Required', 'Upgrade to Pro to access saved backgrounds');
                } else {
                    console.error('Failed to show saved backgrounds:', error);
                    showNotification('Error', 'Failed to show saved backgrounds');
                }
            }
        });

        // Save background button
        document.querySelector('.save-background-button')?.addEventListener('click', async () => {
            try {
                await requirePremium('saved_backgrounds', async () => {
                    await backgroundService.toggleSaveBackground();
                });
            } catch (error) {
                if (error.message === 'Premium feature not available') {
                    showNotification('Premium Required', 'Upgrade to Pro to save backgrounds');
                } else {
                    console.error('Failed to toggle background:', error);
                    showNotification('Error', error.message || 'Failed to update background');
                }
            }
        });

        // Daily Reminders menu item
        document.querySelector('.daily-reminders-item')?.addEventListener('click', async () => {
            try {
                await requirePremium('daily_reminder', () => {
                    reminderSettings.show();
                });
            } catch (error) {
                if (error.message === 'Premium feature not available') {
                    showNotification('Premium Required', 'Upgrade to Pro to use daily reminders');
                } else {
                    console.error('Failed to show reminder settings:', error);
                    showNotification('Error', 'Failed to open reminder settings');
                }
            }
        });

        // Backup & Sync menu item
        const backupMenuItem = Array.from(document.querySelectorAll('li')).find(li => {
            const icon = li.querySelector('i.material-icons-round');
            return icon && icon.textContent.trim() === 'backup';
        });
        
        if (backupMenuItem) {
            backupMenuItem.addEventListener('click', async () => {
                try {
                    await requirePremium('backup_sync', () => {
                        backupRestoreDialog.show();
                    });
                } catch (error) {
                    if (error.message === 'Premium feature not available') {
                        showNotification('Premium Required', 'Upgrade to Pro to use backup & sync');
                    } else {
                        console.error('Failed to show backup dialog:', error);
                        showNotification('Error', 'Failed to open backup dialog');
                    }
                }
            });
        }

        // Notes Widget
        const saveNoteButton = document.getElementById('saveNoteButton');
        const newNoteTextarea = document.getElementById('newNoteTextarea');
        saveNoteButton?.addEventListener('click', async () => {
            if (newNoteTextarea && newNoteTextarea.value.trim() !== '') {
                await notesService.addNote(newNoteTextarea.value);
                newNoteTextarea.value = ''; // Clear textarea
                this.renderNotes(); // Re-render
            }
        });

        // Todo List Widget
        const addTodoButton = document.getElementById('addTodoButton');
        const newTodoInput = document.getElementById('newTodoInput');
        addTodoButton?.addEventListener('click', async () => {
            if (newTodoInput && newTodoInput.value.trim() !== '') {
                await todoService.addTodo(newTodoInput.value);
                newTodoInput.value = ''; // Clear input
                this.renderTodos(); // Re-render
            }
        });
        newTodoInput?.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && newTodoInput.value.trim() !== '') {
                await todoService.addTodo(newTodoInput.value);
                newTodoInput.value = ''; // Clear input
                this.renderTodos(); // Re-render
            }
        });

        // Old menu toggles for Notes and Todo have been removed from HTML,
        // so their listeners (which were ID-based) are effectively removed
        // by removing the elements themselves. No specific JS code removal
        // is needed here for those ID-based listeners if the elements are gone.
    }

    // Setup panel interactions
    setupPanelInteractions() {
        const settingsButton = document.getElementById('settingsButton');
        const settingsPanel = document.getElementById('settingsPanel');
        const menuButton = document.getElementById('menuButton');
        const menuPanel = document.getElementById('menuPanel');

        if (!settingsButton || !settingsPanel || !menuButton || !menuPanel) {
            console.warn('Some panel elements not found');
            return;
        }

        // Settings controls
        const showWeatherCheckbox = document.getElementById('showWeather');
        const showClockCheckbox = document.getElementById('showClock');
        const backgroundThemeSelect = document.getElementById('backgroundTheme');
        const cardStyleSelect = document.getElementById('cardStyle');
        const fontStyleSelect = document.getElementById('fontStyle');
        const textColorInput = document.getElementById('textColor');

        // Initialize settings with current values
        const settings = stateManager.getSettings();
        if (showWeatherCheckbox) showWeatherCheckbox.checked = settings.showWeather;
        if (showClockCheckbox) showClockCheckbox.checked = settings.showClock;
        
        const showAffirmationCheckbox = document.getElementById('showAffirmation');
        const affirmationCard = document.querySelector('.affirmation-card');
        if (showAffirmationCheckbox) {
            showAffirmationCheckbox.checked = settings.showAffirmation;
        }
        affirmationCard?.classList.toggle('hidden', !settings.showAffirmation);

        // Notes Toggle
        const showNotesCheckbox = document.getElementById('showNotes');
        const notesWidget = document.getElementById('notes-widget');
        if (showNotesCheckbox) {
            showNotesCheckbox.checked = settings.showNotes; // Use new setting key
        }
        notesWidget?.classList.toggle('hidden', !settings.showNotes); // Apply on load

        // Todo List Toggle
        const showTodoCheckbox = document.getElementById('showTodo');
        const todoWidget = document.getElementById('todo-widget');
        if (showTodoCheckbox) {
            showTodoCheckbox.checked = settings.showTodo; // Use new setting key
        }
        todoWidget?.classList.toggle('hidden', !settings.showTodo); // Apply on load

        if (backgroundThemeSelect) backgroundThemeSelect.value = settings.backgroundTheme;
        if (cardStyleSelect) cardStyleSelect.value = settings.cardStyle;
        if (fontStyleSelect) fontStyleSelect.value = settings.fontStyle;
        if (textColorInput) textColorInput.value = settings.textColor;

        // Apply initial styles
        this.applyThemeSettings(settings);

        // Add event listeners for settings changes
        // Weather Toggle
        const weatherWidget = document.getElementById('weather-widget'); 
        weatherWidget?.classList.toggle('hidden', !settings.showWeather); 

        showWeatherCheckbox?.addEventListener('change', async (e) => {
            await stateManager.updateSettings({ showWeather: e.target.checked });
            weatherWidget?.classList.toggle('hidden', !e.target.checked);
        });

        // Clock Toggle
        const timeWidget = document.querySelector('.time-widget'); 
        timeWidget?.classList.toggle('hidden', !settings.showClock); 

        showClockCheckbox?.addEventListener('change', async (e) => {
            await stateManager.updateSettings({ showClock: e.target.checked });
            timeWidget?.classList.toggle('hidden', !e.target.checked);
        });

        // Affirmation Toggle
        showAffirmationCheckbox?.addEventListener('change', async (e) => {
            await stateManager.updateSettings({ showAffirmation: e.target.checked });
            affirmationCard?.classList.toggle('hidden', !e.target.checked);
        });
        
        // Notes Toggle Event Listener
        showNotesCheckbox?.addEventListener('change', async (e) => {
            await stateManager.updateSettings({ showNotes: e.target.checked }); // Use new setting key
            notesWidget?.classList.toggle('hidden', !e.target.checked);
        });

        // Todo List Toggle Event Listener
        showTodoCheckbox?.addEventListener('change', async (e) => {
            await stateManager.updateSettings({ showTodo: e.target.checked }); // Use new setting key
            todoWidget?.classList.toggle('hidden', !e.target.checked);
        });

        backgroundThemeSelect?.addEventListener('change', async (e) => {
            const newTheme = e.target.value;
            await stateManager.updateSettings({ backgroundTheme: newTheme });
            
            // Clear the background cache to force new image fetch
            await chrome.storage.local.remove('background_data');
            
            // Update background with new theme
            await backgroundService.update();
            
            // Show notification
            showNotification('Theme Updated', 'Background theme has been changed');
        });

        cardStyleSelect?.addEventListener('change', (e) => {
            const newStyle = e.target.value;
            stateManager.updateSettings({ cardStyle: newStyle });
            this.updateCardStyles(newStyle);
        });

        fontStyleSelect?.addEventListener('change', (e) => {
            const newFont = e.target.value;
            stateManager.updateSettings({ fontStyle: newFont });
            
            // Remove all font classes using a more robust approach
            const classes = document.body.className.split(' ');
            const nonFontClasses = classes.filter(cls => !cls.startsWith('font-'));
            document.body.className = nonFontClasses.join(' ');
            
            // Add the new font class and ensure font-fallback is present
            document.body.classList.add(`font-${newFont}`, 'font-fallback');
        });

        textColorInput?.addEventListener('change', (e) => {
            const newColor = e.target.value;
            stateManager.updateSettings({ textColor: newColor });
            document.documentElement.style.setProperty('--color-text-primary', newColor);
            document.documentElement.style.setProperty('--color-text-secondary', this.adjustColorOpacity(newColor, 0.7));
        });

        // Settings panel toggle
        settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanel.classList.toggle('hidden');
            menuPanel.classList.add('hidden');
        });

        // Menu panel toggle
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            menuPanel.classList.toggle('hidden');
            settingsPanel.classList.add('hidden');
        });

        // Close panels when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsPanel.contains(e.target) && !settingsButton.contains(e.target)) {
                settingsPanel.classList.add('hidden');
            }
            if (!menuPanel.contains(e.target) && !menuButton.contains(e.target)) {
                menuPanel.classList.add('hidden');
            }
        });
    }

    // Apply theme settings
    applyThemeSettings(settings) {
        // Apply card style
        this.updateCardStyles(settings.cardStyle);

        // Apply font style while maintaining font-fallback
        document.body.className = document.body.className
            .replace(/font-\w+/, '')
            .trim();
        document.body.classList.add(`font-${settings.fontStyle}`, 'font-fallback');

        // Apply text color
        document.documentElement.style.setProperty('--color-text-primary', settings.textColor);
        document.documentElement.style.setProperty('--color-text-secondary', this.adjustColorOpacity(settings.textColor, 0.7));
    }

    // Update card styles
    updateCardStyles(style) {
        const widgets = document.querySelectorAll('.glass, .solid, .minimal');
        widgets.forEach(widget => {
            widget.classList.remove('glass', 'solid', 'minimal');
            widget.classList.add(style);
        });
    }

    // Adjust color opacity
    adjustColorOpacity(color, opacity) {
        const r = parseInt(color.substr(1,2), 16);
        const g = parseInt(color.substr(3,2), 16);
        const b = parseInt(color.substr(5,2), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // Toggle focus mode
    async toggleFocusMode() {
        const body = document.body;
        const focusModeClass = 'focus-mode';
        const elements = document.querySelectorAll('.weather, .time-widget, .settings-button, .menu-button, .photo-credit');
        
        const toggleElements = (show) => {
            elements.forEach(el => {
                el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                el.style.opacity = show ? '1' : '0';
                el.style.transform = show ? 'none' : 'scale(0.9)';
                el.style.pointerEvents = show ? 'auto' : 'none';
            });
        };

        const isFocusModeActive = body.classList.contains(focusModeClass);
        
        if (isFocusModeActive) {
            // Exit focus mode
            body.classList.remove(focusModeClass);
            toggleElements(true);
            document.getElementById('background-overlay').style.filter = 'brightness(0.85) saturate(1.1)';
        } else {
            // Enter focus mode
            body.classList.add(focusModeClass);
            toggleElements(false);
            document.getElementById('background-overlay').style.filter = 'brightness(0.6) saturate(1.2) blur(3px)';
        }

        // Save state
        await stateManager.updateSettings({
            focusMode: !isFocusModeActive
        });
    }

    // Handle initialization errors
    handleInitializationError(error) {
        console.error('Failed to initialize the application:', error);
        
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-container glass';
        errorContainer.innerHTML = `
            <div class="error-content">
                <h2>Something went wrong</h2>
                <p>We couldn't initialize some features. Please try refreshing the page.</p>
                <button onclick="window.location.reload()">Refresh Page</button>
            </div>
        `;
        
        document.body.appendChild(errorContainer);
    }

    // Initialize the app
    async initialize() {
        if (this.initialized) return;

        try {
            // Initialize services
            await this.initializeServices();
            await this.initializeUI();
            this.initialized = true;
        } catch (error) {
            this.handleInitializationError(error);
        }
    }

    // Cleanup resources
    cleanup() {
        // Clean up draggable widgets
        if (this.cleanup && this.cleanup.draggable) {
            this.cleanup.draggable.forEach(cleanup => cleanup());
            this.cleanup.draggable.clear();
        }

        // Clean up animations
        if (this.cleanup && this.cleanup.animations) {
            this.cleanup.animations.clearAll();
        }

        // Clean up daily reminder service
        dailyReminderService.cleanup();
    }
}

// Create and initialize app when DOM is loaded
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.initialize());

// Cleanup before page unload
window.addEventListener('beforeunload', () => {
    if (app && typeof app.cleanup === 'function') {
        app.cleanup();
    }
});

// Export for debugging
window.app = app;