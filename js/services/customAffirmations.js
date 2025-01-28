// Custom Affirmations Service
import stateManager from '../modules/state.js';
import { showNotification } from '../utils/common.js';
import { requirePremium, setupPremiumUI } from '../utils/premium.js';

class CustomAffirmationsService {
    constructor() {
        this.currentCollection = 'personal';
        this.dialog = document.getElementById('customAffirmationsDialog');
        this.setupEventListeners();
    }

    // Initialize the service
    async init() {
        this.renderAffirmations();
        this.setupCollectionTabs();
    }

    // Setup event listeners
    setupEventListeners() {
        // Open dialog button
        const customAffirmationsButton = document.getElementById('customAffirmationsButton');
        if (customAffirmationsButton) {
            setupPremiumUI(customAffirmationsButton, 'custom_affirmations');
            customAffirmationsButton.addEventListener('click', () => {
                this.showDialog();
            });
        }

        // Close dialog button
        this.dialog?.querySelector('.close-button')?.addEventListener('click', () => {
            this.hideDialog();
        });

        // Add new affirmation
        const addForm = this.dialog?.querySelector('.add-affirmation');
        const input = document.getElementById('newAffirmation');
        const addButton = addForm?.querySelector('.add-button');

        addButton?.addEventListener('click', () => {
            if (input?.value.trim()) {
                this.addAffirmation(input.value.trim());
                input.value = '';
            }
        });

        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                this.addAffirmation(input.value.trim());
                input.value = '';
            }
        });

        // Collection tabs
        this.dialog?.querySelector('.collections-tabs')?.addEventListener('click', (e) => {
            const button = e.target.closest('.tab-button');
            if (button) {
                const collection = button.dataset.collection;
                this.switchCollection(collection);
            }
        });

        // Click outside to close
        this.dialog?.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.hideDialog();
            }
        });
    }

    // Show dialog
    showDialog() {
        requirePremium('custom_affirmations', () => {
            this.dialog?.classList.add('show');
            this.renderAffirmations();
        });
    }

    // Hide dialog
    hideDialog() {
        this.dialog?.classList.remove('show');
    }

    // Switch collection
    switchCollection(collection) {
        const tabs = this.dialog?.querySelectorAll('.tab-button');
        tabs?.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.collection === collection);
        });
        this.currentCollection = collection;
        this.renderAffirmations();
    }

    // Add new affirmation
    async addAffirmation(text) {
        const settings = stateManager.getSettings();
        const collections = settings.customCollections || {
            personal: [],
            motivation: [],
            gratitude: [],
            success: []
        };

        collections[this.currentCollection].push({
            id: Date.now(),
            text,
            createdAt: new Date().toISOString()
        });

        await stateManager.updateSettings({ customCollections: collections });
        this.renderAffirmations();
        showNotification('Affirmation Added', 'Your affirmation has been saved');
    }

    // Delete affirmation
    async deleteAffirmation(id) {
        const settings = stateManager.getSettings();
        const collections = settings.customCollections;

        // Find the affirmation before deleting to get its text
        const affirmation = collections[this.currentCollection].find(aff => aff.id === id);

        // Only remove from custom affirmations collection
        collections[this.currentCollection] = collections[this.currentCollection]
            .filter(aff => aff.id !== id);

        await stateManager.updateSettings({ customCollections: collections });
        this.renderAffirmations();

        if (affirmation) {
            showNotification('Custom Affirmation Deleted',
                'Affirmation removed from custom collection only. If you added it to favorites, it will remain in your favorites list.');
        }
    }

    // Render affirmations list
    renderAffirmations() {
        const listContainer = this.dialog?.querySelector('.affirmations-list');
        if (!listContainer) return;

        const settings = stateManager.getSettings();
        const collections = settings.customCollections || {
            personal: [],
            motivation: [],
            gratitude: [],
            success: []
        };
        const affirmations = collections[this.currentCollection] || [];

        if (affirmations.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>No affirmations in this collection yet.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = affirmations.map(aff => `
            <div class="affirmation-item" data-id="${aff.id}">
                <div class="affirmation-text">${aff.text}</div>
                <div class="affirmation-actions">
                    <button class="action-icon" data-action="use" title="Use this affirmation">
                        <i class="material-icons-round">play_arrow</i>
                    </button>
                    <button class="action-icon" data-action="delete" title="Remove from custom affirmations only">
                        <i class="material-icons-round">delete</i>
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners to action buttons
        listContainer.querySelectorAll('.action-icon').forEach(button => {
            button.addEventListener('click', async (e) => {
                const action = button.dataset.action;
                const id = parseInt(button.closest('.affirmation-item').dataset.id);

                if (action === 'delete') {
                    await this.deleteAffirmation(id);
                } else if (action === 'use') {
                    const affirmation = affirmations.find(a => a.id === id);
                    if (affirmation) {
                        document.getElementById('affirmation').textContent = affirmation.text;
                        this.hideDialog();
                        showNotification('Affirmation Set', 'Your custom affirmation is now displayed');
                    }
                }
            });
        });
    }

    // Setup collection tabs
    setupCollectionTabs() {
        const tabs = this.dialog?.querySelectorAll('.tab-button');
        tabs?.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchCollection(tab.dataset.collection);
            });
        });
    }
}

// Create and export singleton instance
const customAffirmationsService = new CustomAffirmationsService();
export default customAffirmationsService; 