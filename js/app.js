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
import pomodoroService from './services/pomodoro.js';
import goalsService from './services/goals.js';
import habitsService from './services/habits.js';
import quickLinksService from './services/quickLinks.js';
import siteBlockerService from './services/siteBlocker.js';
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
            draggable: new Map(), // Changed from Set to Map
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
            todo: false,
            pomodoro: false,
            goalTracker: false,
            quickLinks: false,
            siteBlocker: false
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
                
                // Pomodoro service initialization
                // Pass `this` (app instance) and `stateManager`
                pomodoroService.initialize(this, stateManager)
                    .then(() => serviceStatus.pomodoro = true)
                    .catch(error => {
                        console.error('Pomodoro service initialization failed:', error);
                        return false;
                    }),
                
                // Goal Tracker service initialization
                goalsService.initialize()
                    .then(() => {
                        serviceStatus.goalTracker = true;
                        // Initial render of goals after service is initialized
                        if (typeof this.renderGoals === 'function') { 
                            this.renderGoals();
                        }
                    })
                    .catch(error => {
                        console.error('Goal Tracker service initialization failed:', error);
                        return false;
                    }),
                
                // Quick Links service initialization
                quickLinksService.initialize()
                    .then(() => {
                        serviceStatus.quickLinks = true;
                        if (typeof this.renderQuickLinks === 'function') {
                            this.renderQuickLinks();
                        }
                    })
                    .catch(error => {
                        console.error('Quick Links service initialization failed:', error);
                        return false;
                    }),
                
                // Site Blocker service initialization
                siteBlockerService.initialize()
                    .then(() => {
                        serviceStatus.siteBlocker = true;
                        // Initial render after service is initialized
                        if (typeof this.renderSiteBlockerList === 'function') {
                            this.renderSiteBlockerList();
                        }
                        // Initialize master toggle state in UI
                        const masterToggle = document.getElementById('masterBlockerToggle');
                        if (masterToggle) {
                            masterToggle.checked = siteBlockerService.getBlockerEnabledStatus();
                        }
                    })
                    .catch(error => console.error('Site Blocker service initialization failed:', error)),
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
            this.renderGoals(); 
            this.renderHabits(); // Call renderHabits here
        } catch (error) {
            console.error('UI initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    // Initialize draggable widgets
    initializeDraggableWidgets() {
        // Ensure all potentially draggable widgets are processed on initial load
        const widgetSelectors = ['#weather-widget', '#time-widget', '#notes-widget', '#todo-widget', '#affirmation-widget', '#pomodoro-widget', '#goal-tracker-widget', '#habit-tracker-widget', '#quick-links-widget', '#site-blocker-widget'];
        widgetSelectors.forEach(selector => {
            // Extract ID from selector for makeWidgetDraggableById
            const widgetId = selector.startsWith('#') ? selector.substring(1) : selector;
            this.makeWidgetDraggableById(widgetId);
        });
    }

    // Helper to make a single widget draggable by its ID
    makeWidgetDraggableById(widgetId) {
        const widgetElement = document.getElementById(widgetId);

        if (widgetElement && !widgetElement.classList.contains('hidden')) {
            // Check if already has a cleanup function to prevent duplicates
            if (this.cleanup.draggable.has(widgetId)) {
                // Potentially remove old one if re-initializing, though makeDraggable might handle this
                // this.cleanup.draggable.get(widgetId)(); 
                // this.cleanup.draggable.delete(widgetId);
                return; // Already draggable or re-initialization logic needs care
            }

            const handle = widgetElement.querySelector('.widget-handle');
            if (!handle) {
                console.warn(`No handle found for widget: ${widgetId}`);
                return;
            }

            const cleanupFunc = makeDraggable(widgetElement, {
                handle: handle,
                onDragEnd: async (element, position) => {
                    const currentWidgetId = element.id; // Should be the same as widgetId
                    const storageId = currentWidgetId.replace('-widget', '');
                    
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

            if (cleanupFunc) {
                this.cleanup.draggable.set(widgetId, cleanupFunc); // Store cleanup by ID
            }
        } else if (widgetElement && widgetElement.classList.contains('hidden')) {
            // If widget is hidden, ensure any previous draggable cleanup is called and removed
            if (this.cleanup.draggable.has(widgetId)) {
                const cleanupFunc = this.cleanup.draggable.get(widgetId);
                if (cleanupFunc) cleanupFunc();
                this.cleanup.draggable.delete(widgetId);
            }
        } else {
            // console.warn(`Widget not found or explicitly not made draggable: ${widgetId}`);
        }
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

        // Pomodoro Controls
        document.getElementById('pomodoroStartPause')?.addEventListener('click', () => {
            pomodoroService.startPause();
        });
        document.getElementById('pomodoroReset')?.addEventListener('click', () => {
            pomodoroService.reset();
        });
        document.getElementById('pomodoroSkip')?.addEventListener('click', () => {
            pomodoroService.skip();
        });

        // Goal Tracker Controls
        const newGoalInput = document.getElementById('newGoalInput');
        const addGoalButton = document.getElementById('addGoalButton');

        const addNewGoal = async () => {
            if (newGoalInput && newGoalInput.value.trim() !== '') {
                await goalsService.addGoal(newGoalInput.value.trim());
                newGoalInput.value = ''; // Clear input
                // 'this' context is implicitly correct here if setupEventListeners is a class method
                // and renderGoals is also a class method.
                this.renderGoals(); // Re-render 
            }
        };

        addGoalButton?.addEventListener('click', addNewGoal);
        newGoalInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addNewGoal();
            }
        });

        // Quick Links Modal & Form Event Listeners
        document.getElementById('showAddLinkModalButton')?.addEventListener('click', () => this.openLinkModal());
        document.getElementById('closeLinkModalButton')?.addEventListener('click', () => this.closeLinkModal());
        document.getElementById('cancelLinkModalButton')?.addEventListener('click', () => this.closeLinkModal());
        
        document.getElementById('linkUrlInput')?.addEventListener('input', () => this.handleLinkUrlInputChange());

        document.getElementById('linkForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('linkIdInput').value;
            const title = document.getElementById('linkTitleInput').value;
            const url = document.getElementById('linkUrlInput').value;

            if (!title.trim() || !url.trim()) {
                showNotification('Error', 'Title and URL are required.'); // Using existing showNotification
                return;
            }

            if (id) { // Editing existing link
                await quickLinksService.updateLink({ id, title, url });
            } else { // Adding new link
                await quickLinksService.addLink({ title, url });
            }
            this.renderQuickLinks();
            this.closeLinkModal();
        });
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

        // Pomodoro Timer Toggle
        const showPomodoroCheckbox = document.getElementById('showPomodoro');
        const pomodoroWidgetElement = document.getElementById('pomodoro-widget');
        if (showPomodoroCheckbox) {
            showPomodoroCheckbox.checked = settings.showPomodoro;
        }
        pomodoroWidgetElement?.classList.toggle('hidden', !settings.showPomodoro);


        if (backgroundThemeSelect) backgroundThemeSelect.value = settings.backgroundTheme;
        if (cardStyleSelect) cardStyleSelect.value = settings.cardStyle;
        if (fontStyleSelect) fontStyleSelect.value = settings.fontStyle;
        if (textColorInput) textColorInput.value = settings.textColor;

        // Apply initial styles
        this.applyThemeSettings(settings);

        // Initialize Pomodoro settings inputs
        const pomodoroSettings = pomodoroService.getSettings(); // Get current pomodoro settings
        const workDurationInput = document.getElementById('pomodoroWorkDuration');
        const shortBreakDurationInput = document.getElementById('pomodoroShortBreakDuration');
        const longBreakDurationInput = document.getElementById('pomodoroLongBreakDuration');
        const cyclesInput = document.getElementById('pomodoroCycles');
        const soundEnabledCheckbox = document.getElementById('pomodoroSoundEnabled');

        if (workDurationInput) workDurationInput.value = pomodoroSettings.workDuration / 60;
        if (shortBreakDurationInput) shortBreakDurationInput.value = pomodoroSettings.shortBreakDuration / 60;
        if (longBreakDurationInput) longBreakDurationInput.value = pomodoroSettings.longBreakDuration / 60;
        if (cyclesInput) cyclesInput.value = pomodoroSettings.cyclesBeforeLongBreak;
        if (soundEnabledCheckbox) soundEnabledCheckbox.checked = pomodoroSettings.soundEnabled;

        // Add event listeners for Pomodoro settings changes
        workDurationInput?.addEventListener('change', (e) => {
            pomodoroService.updateSettings({ workDuration: parseInt(e.target.value) * 60 });
        });
        shortBreakDurationInput?.addEventListener('change', (e) => {
            pomodoroService.updateSettings({ shortBreakDuration: parseInt(e.target.value) * 60 });
        });
        longBreakDurationInput?.addEventListener('change', (e) => {
            pomodoroService.updateSettings({ longBreakDuration: parseInt(e.target.value) * 60 });
        });
        cyclesInput?.addEventListener('change', (e) => {
            pomodoroService.updateSettings({ cyclesBeforeLongBreak: parseInt(e.target.value) });
        });
        soundEnabledCheckbox?.addEventListener('change', (e) => {
            pomodoroService.updateSettings({ soundEnabled: e.target.checked });
        });

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
            if (e.target.checked) this.makeWidgetDraggableById('todo-widget');
        });

        // Pomodoro Timer Toggle Event Listener
        showPomodoroCheckbox?.addEventListener('change', async (e) => {
            await stateManager.updateSettings({ showPomodoro: e.target.checked });
            pomodoroWidgetElement?.classList.toggle('hidden', !e.target.checked);
            if (e.target.checked && pomodoroWidgetElement) {
                this.makeWidgetDraggableById('pomodoro-widget');
            }
        });

        // Goal Tracker Toggle Event Listener
        const showGoalTrackerCheckbox = document.getElementById('showGoalTracker');
        const goalTrackerWidgetElement = document.getElementById('goal-tracker-widget');
        // Initial state application is already handled earlier in setupPanelInteractions
        showGoalTrackerCheckbox?.addEventListener('change', async (e) => {
            await stateManager.updateSettings({ showGoalTracker: e.target.checked });
            goalTrackerWidgetElement?.classList.toggle('hidden', !e.target.checked);
            if (e.target.checked && goalTrackerWidgetElement) {
                this.makeWidgetDraggableById('goal-tracker-widget');
                if (typeof this.renderGoals === 'function') { // Re-render if becoming visible
                    this.renderGoals();
                }
            }
        });

        // Quick Links Toggle Event Listener
        const showQuickLinksCheckbox = document.getElementById('showQuickLinks');
        const quickLinksWidgetElement = document.getElementById('quick-links-widget');
        // Initial state application is handled earlier in setupPanelInteractions
        showQuickLinksCheckbox?.addEventListener('change', async (e) => {
            await stateManager.updateSettings({ showQuickLinks: e.target.checked });
            quickLinksWidgetElement?.classList.toggle('hidden', !e.target.checked);
            if (e.target.checked && quickLinksWidgetElement) {
                this.makeWidgetDraggableById('quick-links-widget');
                if (typeof this.renderQuickLinks === 'function') {
                    this.renderQuickLinks();
                }
            }
        });

        // Site Blocker Toggle Event Listener
        const showSiteBlockerCheckbox = document.getElementById('showSiteBlocker');
        const siteBlockerWidgetElement = document.getElementById('site-blocker-widget');
        // Initial state application is handled earlier in setupPanelInteractions
        showSiteBlockerCheckbox?.addEventListener('change', async (e) => {
            await stateManager.updateSettings({ showSiteBlocker: e.target.checked });
            siteBlockerWidgetElement?.classList.toggle('hidden', !e.target.checked);
            if (e.target.checked && siteBlockerWidgetElement) {
                this.makeWidgetDraggableById('site-blocker-widget');
                if (typeof this.renderSiteBlockerList === 'function') { // Re-render if becoming visible
                    this.renderSiteBlockerList();
                }
            }
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

    // Render Goals
    async renderGoals() {
        if (!goalsService) return; // Guard if service not ready

        const goals = goalsService.getGoals();
        const goalsListContainer = document.getElementById('goalsListContainer');
        if (!goalsListContainer) return;

        goalsListContainer.innerHTML = ''; // Clear existing goals

        if (goals.length === 0) {
            goalsListContainer.innerHTML = '<li class="empty-state-message">No goals yet. Add one above!</li>';
            return;
        }

        goals.forEach(goal => {
            const goalItem = document.createElement('li');
            goalItem.className = `goal-item ${goal.completed ? 'completed' : ''}`;
            goalItem.dataset.goalId = goal.id;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'goal-checkbox';
            checkbox.checked = goal.completed;
            checkbox.addEventListener('change', async () => {
                await goalsService.toggleGoalCompletion(goal.id);
                this.renderGoals(); // Re-render the list
            });

            const textSpan = document.createElement('span');
            textSpan.className = 'goal-text';
            textSpan.textContent = goal.text;
            textSpan.setAttribute('contenteditable', 'false'); // Initially not editable

            textSpan.addEventListener('dblclick', () => { // Double click to edit
                textSpan.setAttribute('contenteditable', 'true');
                textSpan.focus();
            });

            textSpan.addEventListener('blur', async () => { // Save on blur
                textSpan.setAttribute('contenteditable', 'false');
                const newText = textSpan.textContent.trim();
                if (newText && newText !== goal.text) {
                    await goalsService.updateGoalText(goal.id, newText);
                    // No re-render needed if only text changed and visual is updated directly
                } else {
                    textSpan.textContent = goal.text; // Revert if empty or unchanged
                }
            });
            
            textSpan.addEventListener('keydown', async (e) => { // Save on Enter
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent newline in contenteditable
                    textSpan.blur(); // Trigger blur to save
                } else if (e.key === 'Escape') {
                     textSpan.textContent = goal.text; // Revert changes
                     textSpan.blur();
                }
            });

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-goal-button small-icon-button';
            deleteButton.innerHTML = '<i class="material-icons-round">delete</i>';
            deleteButton.title = 'Delete Goal';
            deleteButton.addEventListener('click', async () => {
                await goalsService.deleteGoal(goal.id);
                this.renderGoals(); // Re-render
            });
            
            goalItem.appendChild(checkbox);
            goalItem.appendChild(textSpan);
            goalItem.appendChild(deleteButton);
            goalsListContainer.appendChild(goalItem);
        });
    }

    // Render Quick Links
    async renderQuickLinks() {
        if (!quickLinksService) return;
        const links = quickLinksService.getLinks();
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;

        gridContainer.innerHTML = ''; // Clear existing links

        if (links.length === 0) {
            gridContainer.innerHTML = '<p class="empty-state-message">No links yet. Click the + button to add one!</p>';
            return;
        }

        links.forEach(link => {
            const linkItem = document.createElement('a');
            linkItem.href = link.url;
            linkItem.target = '_blank';
            linkItem.className = 'quick-link-item';
            linkItem.dataset.linkId = link.id;
            linkItem.setAttribute('draggable', 'true'); // For reordering

            const icon = document.createElement('img');
            icon.src = link.iconUrl || 'images/icon-32.png'; // Fallback icon
            icon.alt = ''; // Decorative
            icon.className = 'quick-link-icon';
            icon.onerror = () => { icon.src = 'images/icon-32.png'; }; // Handle broken icon links

            const title = document.createElement('span');
            title.className = 'quick-link-title';
            title.textContent = link.title;

            const actions = document.createElement('div');
            actions.className = 'quick-link-actions';
            
            const editButton = document.createElement('button');
            editButton.className = 'edit-link-button small-icon-button';
            editButton.title = 'Edit link';
            editButton.innerHTML = '<i class="material-icons-round">edit</i>';
            editButton.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation(); this.openLinkModal(link);
            });

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-link-button small-icon-button';
            deleteButton.title = 'Delete link';
            deleteButton.innerHTML = '<i class="material-icons-round">delete_outline</i>';
            deleteButton.addEventListener('click', async (e) => {
                e.preventDefault(); e.stopPropagation();
                // Consider using a custom confirmation dialog here instead of confirm() for better UX
                if (confirm(`Delete "${link.title}"?`)) { 
                    await quickLinksService.deleteLink(link.id);
                    this.renderQuickLinks();
                }
            });

            actions.appendChild(editButton);
            actions.appendChild(deleteButton);
            linkItem.appendChild(icon);
            linkItem.appendChild(title);
            linkItem.appendChild(actions);
            gridContainer.appendChild(linkItem);
        });
        this.setupLinkDragAndDrop(); // Call D&D setup after rendering
    }

    // --- Quick Links Modal Logic ---
    openLinkModal(linkToEdit = null) {
        const modal = document.getElementById('addEditLinkModal');
        const form = document.getElementById('linkForm');
        const modalTitle = document.getElementById('linkModalTitle');
        const linkIdInput = document.getElementById('linkIdInput');
        const linkUrlInput = document.getElementById('linkUrlInput');
        const linkTitleInput = document.getElementById('linkTitleInput');
        const iconPreview = document.getElementById('linkIconPreview');

        form.reset(); // Clear previous entries
        if (linkToEdit) {
            modalTitle.textContent = 'Edit Link';
            linkIdInput.value = linkToEdit.id;
            linkUrlInput.value = linkToEdit.url;
            linkTitleInput.value = linkToEdit.title;
            iconPreview.src = linkToEdit.iconUrl || 'images/icon-32.png';
        } else {
            modalTitle.textContent = 'Add New Link';
            linkIdInput.value = ''; // Important for differentiating add vs edit
            linkUrlInput.value = ''; // Clear URL for new link
            linkTitleInput.value = ''; // Clear title for new link
            iconPreview.src = 'images/icon-32.png'; // Default preview
        }
        modal?.classList.remove('hidden');
    }

    closeLinkModal() {
        document.getElementById('addEditLinkModal')?.classList.add('hidden');
    }
    
    // Helper for URL input change to update icon preview and suggest title
    handleLinkUrlInputChange() {
        const linkUrlInput = document.getElementById('linkUrlInput');
        const linkTitleInput = document.getElementById('linkTitleInput');
        const iconPreview = document.getElementById('linkIconPreview');
        
        const url = linkUrlInput.value.trim();
        if (url) {
            let prefixedUrl = url;
            if (!prefixedUrl.startsWith('http://') && !prefixedUrl.startsWith('https://')) {
                prefixedUrl = 'https://' + prefixedUrl;
            }
            iconPreview.src = quickLinksService.getFaviconUrl(prefixedUrl);
            iconPreview.onerror = () => { iconPreview.src = 'images/icon-32.png'; }; // Fallback on error
            
            // Suggest title only if title input is empty and it's a new link
            if (!document.getElementById('linkIdInput').value && !linkTitleInput.value) {
                linkTitleInput.value = quickLinksService.suggestTitleFromUrl(prefixedUrl);
            }
        } else {
            iconPreview.src = 'images/icon-32.png';
        }
    }
    // --- End Quick Links Modal Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // --- Quick Links Drag and Drop Logic ---
    setupLinkDragAndDrop() {
        const gridContainer = document.getElementById('quickLinksGridContainer');
        if (!gridContainer) return;
        let draggedItem = null;

        gridContainer.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('quick-link-item')) {
                draggedItem = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0); // For visual feedback
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            if (draggedItem && e.target.classList.contains('quick-link-item')) {
                e.target.classList.remove('dragging');
                draggedItem = null;
                
                // Get new order of IDs
                const newOrderIds = [];
                gridContainer.querySelectorAll('.quick-link-item').forEach(item => {
                    newOrderIds.push(item.dataset.linkId);
                });
                quickLinksService.reorderLinks(newOrderIds);
                // No re-render needed if visual order is already correct by DOM manipulation
            }
        });

        gridContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow drop
            const afterElement = this.getDragAfterElement(gridContainer, e.clientX, e.clientY); // Use clientX/Y for grid
            if (draggedItem) {
                if (afterElement == null) {
                    gridContainer.appendChild(draggedItem);
                } else {
                    gridContainer.insertBefore(draggedItem, afterElement);
                }
            }
        });
    }
    
    // Helper for dragover (adjust for grid if needed)
    getDragAfterElement(container, x, y) {
      const draggableElements = [...container.querySelectorAll('.quick-link-item:not(.dragging)')];
      return draggableElements.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          // For grid, check both X and Y. This is a simplified version.
          const offsetY = y - box.top - box.height / 2;
          const offsetX = x - box.left - box.width / 2; 

          // This heuristic attempts to find the element that the dragged item should come "before".
          // It prioritizes elements that are "below" the cursor's Y position first.
          // If multiple elements are below, it prefers the one whose vertical center is closer.
          // If the cursor's Y is within an element's vertical bounds, it then considers horizontal position.
          
          if (offsetY < 0 && offsetY > closest.offsetY) { // Cursor is above the center of 'child', and 'child' is closer than previous 'closest'
              return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && closest.offsetY < 0) { // Current 'child' is below cursor, but previous 'closest' was above. This 'child' is a better candidate.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (offsetY > 0 && offsetY < closest.offsetY) { // Both 'child' and 'closest' are below cursor, 'child' is closer.
               return { offsetY: offsetY, offsetX: offsetX, element: child };
          } else if (Math.abs(offsetY) < box.height / 2 ) { // Cursor is vertically within the bounds of 'child' (roughly same row)
              if (offsetX < 0 && offsetX > closest.offsetX && closest.offsetY !== Number.NEGATIVE_INFINITY && Math.abs(closest.offsetY) > box.height / 2) {
                 // If previous closest was far vertically, prefer this one even if offsetX is slightly worse, as long as it's to the left.
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              } else if (offsetX < 0 && offsetX > closest.offsetX && Math.abs(offsetY) <= Math.abs(closest.offsetY)) { // And cursor is to the left of 'child's center, and 'child' is closer or equally close horizontally
                 return { offsetY: offsetY, offsetX: offsetX, element: child };
              }
          }
          return closest;
      }, { offsetY: Number.NEGATIVE_INFINITY, offsetX: Number.NEGATIVE_INFINITY }).element;
    }
    // --- End Quick Links Drag and Drop Logic ---

    // Render Site Blocker List
    async renderSiteBlockerList() {
        if (!siteBlockerService) return;
        const hostnames = siteBlockerService.getBlockedHostnames();
        const listContainer = document.getElementById('blockedSitesListContainer');
        if (!listContainer) return;

        listContainer.innerHTML = ''; // Clear existing list

        if (hostnames.length === 0) {
            listContainer.innerHTML = '<li class="empty-state-message">No sites blocked yet.</li>';
            return;
        }

        hostnames.forEach(hostname => {
            const listItem = document.createElement('li');
            listItem.className = 'blocked-site-item';
            listItem.dataset.hostname = hostname;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'blocked-site-hostname';
            nameSpan.textContent = hostname;

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-blocked-site-button small-icon-button';
            deleteButton.innerHTML = '<i class="material-icons-round">remove_circle_outline</i>';
            deleteButton.title = `Remove ${hostname}`;
            deleteButton.addEventListener('click', async () => {
                await siteBlockerService.removeBlockedHostname(hostname);
                this.renderSiteBlockerList(); 
            });
            
            listItem.appendChild(nameSpan);
            listItem.appendChild(deleteButton);
            listContainer.appendChild(listItem);
        });
    }

    // Update Pomodoro UI (called by pomodoro.js)
    updatePomodoroUI({ mode, time, cycle, isRunning, cyclesBeforeLongBreak }) {
        const stateDisplay = document.getElementById('pomodoroStateDisplay');
        const timerDisplay = document.getElementById('pomodoroTimerDisplay');
        const startPauseButton = document.getElementById('pomodoroStartPause');
        const cycleDisplay = document.getElementById('pomodoroCycleDisplay');

        if (stateDisplay) {
            let modeText = 'Work';
            if (mode === 'shortBreak') modeText = 'Short Break';
            else if (mode === 'longBreak') modeText = 'Long Break';
            stateDisplay.textContent = modeText;
        }
        if (timerDisplay) {
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        if (startPauseButton) {
            // const icon = startPauseButton.querySelector('i'); // Icon is part of innerHTML
            if (isRunning) {
                startPauseButton.dataset.action = 'pause';
                startPauseButton.innerHTML = '<i class="material-icons-round">pause</i> Pause';
            } else {
                startPauseButton.dataset.action = 'start';
                startPauseButton.innerHTML = '<i class="material-icons-round">play_arrow</i> Start';
            }
        }
        if (cycleDisplay) {
            if (mode === 'work') {
              cycleDisplay.textContent = `Cycle ${cycle} of ${cyclesBeforeLongBreak}`;
              cycleDisplay.style.display = '';
            } else {
              cycleDisplay.style.display = 'none';
            }
        }
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
            this.cleanup.draggable.forEach(cleanupFunc => cleanupFunc()); // Iterate over Map values
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