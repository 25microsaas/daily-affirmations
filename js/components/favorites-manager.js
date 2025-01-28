// Favorites Manager Component
import affirmationsService from '../services/affirmations.js';
import { showNotification } from '../utils/common.js';

class FavoritesManager {
    constructor() {
        this.dialog = null;
        this.initialize();
    }

    initialize() {
        this.createDialog();
        this.setupEventListeners();
    }

    createDialog() {
        this.dialog = document.createElement('div');
        this.dialog.className = 'favorites-dialog dialog-base';
        this.dialog.innerHTML = `
            <div class="dialog-content glass">
                <div class="dialog-header">
                    <div class="header-content">
                        <i class="material-icons-round header-icon">favorite</i>
                        <h2>Favorites</h2>
                    </div>
                    <button class="close-button glass-button" aria-label="Close dialog">
                        <i class="material-icons-round">close</i>
                    </button>
                </div>
                <div class="dialog-body">
                    <div class="favorite-affirmations-list"></div>
                    <div class="favorite-affirmations-empty">
                        <div class="empty-state-content">
                            <i class="material-icons-round">favorite_border</i>
                            <h3>No favorites yet</h3>
                            <p>Your favorite affirmations will appear here</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.dialog);
    }

    setupEventListeners() {
        // Close button
        this.dialog.querySelector('.close-button').addEventListener('click', () => {
            this.hide();
        });

        // Click outside to close
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.hide();
            }
        });

        // Handle favorite actions
        const favoritesList = this.dialog.querySelector('.favorite-affirmations-list');
        favoritesList.addEventListener('click', async (e) => {
            const button = e.target.closest('.action-icon');
            if (!button) return;

            const action = button.dataset.action;
            const favoriteItem = button.closest('.favorite-item');
            const text = favoriteItem?.querySelector('.favorite-text')?.textContent;

            if (!text) return;

            try {
                switch (action) {
                    case 'remove':
                        // Only remove from favorites list
                        await affirmationsService.removeFromFavorites(text);
                        await this.loadFavorites();
                        showNotification('Removed from Favorites', 'Affirmation removed from your favorites list only. If this is a custom affirmation, it will remain in your custom affirmations.');
                        break;

                    case 'use':
                        affirmationsService.updateDisplay(text);
                        this.hide();
                        showNotification('Updated', 'Using selected affirmation');
                        break;

                    case 'edit-tags':
                        this.showTagEditor(text);
                        break;
                }
            } catch (error) {
                console.error('Failed to handle favorite action:', error);
                showNotification('Error', 'Failed to perform action');
            }
        });
    }

    async loadFavorites() {
        try {
            const favorites = await affirmationsService.getFavoriteAffirmationsWithMetadata();
            this.renderFavorites(favorites);
        } catch (error) {
            console.error('Failed to load favorites:', error);
            this.showError('Failed to load favorites');
        }
    }

    renderFavorites(favorites) {
        const listContainer = this.dialog.querySelector('.favorite-affirmations-list');
        const emptyState = this.dialog.querySelector('.favorite-affirmations-empty');

        if (!favorites.length) {
            listContainer.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        listContainer.style.display = 'block';
        emptyState.style.display = 'none';

        listContainer.innerHTML = favorites.map(favorite => `
            <div class="favorite-item glass">
                <div class="favorite-content">
                    <p class="favorite-text">${favorite.text}</p>
                    <div class="favorite-metadata">
                        <div class="metadata-group">
                            <span class="favorite-date">
                                <i class="material-icons-round">schedule</i>
                                ${new Date(favorite.addedAt).toLocaleDateString()}
                            </span>
                            <div class="tags-container">
                                ${favorite.tags.map(tag => `
                                    <span class="favorite-tag glass-tag">
                                        <i class="material-icons-round tag-icon">label</i>
                                        ${tag}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                        <div class="favorite-actions">
                            <button class="action-icon glass-button" data-action="edit-tags" title="Edit tags">
                                <i class="material-icons-round">label</i>
                            </button>
                            <button class="action-icon glass-button" data-action="use" title="Use this affirmation">
                                <i class="material-icons-round">refresh</i>
                            </button>
                            <button class="action-icon glass-button" data-action="remove" title="Remove from favorites">
                                <i class="material-icons-round">close</i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    showTagEditor(text) {
        const tagEditor = document.createElement('div');
        tagEditor.className = 'tag-editor-dialog dialog-base';
        tagEditor.innerHTML = `
            <div class="dialog-content glass">
                <div class="dialog-header">
                    <div class="header-content">
                        <i class="material-icons-round header-icon">label</i>
                        <h2>Edit Tags</h2>
                    </div>
                    <button class="close-button glass-button" aria-label="Close dialog">
                        <i class="material-icons-round">close</i>
                    </button>
                </div>
                <div class="dialog-body">
                    <div class="tag-editor">
                        <div class="current-tags"></div>
                        <div class="add-tag">
                            <input type="text" placeholder="Add a tag..." class="tag-input glass-input" />
                            <button class="add-button glass-button">
                                <i class="material-icons-round">add</i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(tagEditor);

        // Load current tags
        this.loadCurrentTags(text, tagEditor);

        // Setup event listeners
        const closeButton = tagEditor.querySelector('.close-button');
        closeButton.addEventListener('click', () => {
            tagEditor.remove();
        });

        const addButton = tagEditor.querySelector('.add-button');
        const input = tagEditor.querySelector('.tag-input');

        const addTag = async () => {
            const tag = input.value.trim();
            if (tag) {
                try {
                    await this.updateTags(text, tag);
                    input.value = '';
                    this.loadCurrentTags(text, tagEditor);
                    showNotification('Tag Added', 'Tag has been added successfully');
                } catch (error) {
                    console.error('Failed to add tag:', error);
                    showNotification('Error', 'Failed to add tag');
                }
            }
        };

        addButton.addEventListener('click', addTag);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTag();
            }
        });

        // Click outside to close
        tagEditor.addEventListener('click', (e) => {
            if (e.target === tagEditor) {
                tagEditor.remove();
            }
        });

        // Show dialog with animation
        requestAnimationFrame(() => {
            tagEditor.classList.add('show');
        });
    }

    async loadCurrentTags(text, tagEditor) {
        try {
            const favorites = await affirmationsService.getFavoriteAffirmationsWithMetadata();
            const favorite = favorites.find(f => f.text === text);
            if (!favorite) return;

            const tagsContainer = tagEditor.querySelector('.current-tags');
            tagsContainer.innerHTML = favorite.tags.map(tag => `
                <span class="tag glass-tag">
                    ${tag}
                    <button class="remove-tag glass-button" data-tag="${tag}" title="Remove tag">
                        <i class="material-icons-round">close</i>
                    </button>
                </span>
            `).join('');

            // Setup remove tag buttons
            tagsContainer.querySelectorAll('.remove-tag').forEach(button => {
                button.addEventListener('click', async () => {
                    const tagToRemove = button.dataset.tag;
                    try {
                        await this.updateTags(text, tagToRemove, true);
                        this.loadCurrentTags(text, tagEditor);
                        showNotification('Tag Removed', 'Tag has been removed successfully');
                    } catch (error) {
                        console.error('Failed to remove tag:', error);
                        showNotification('Error', 'Failed to remove tag');
                    }
                });
            });
        } catch (error) {
            console.error('Failed to load tags:', error);
            showNotification('Error', 'Failed to load tags');
        }
    }

    async updateTags(text, tag, remove = false) {
        try {
            const favorites = await affirmationsService.getFavoriteAffirmationsWithMetadata();
            const favorite = favorites.find(f => f.text === text);
            if (!favorite) return;

            let tags = [...favorite.tags];
            if (remove) {
                tags = tags.filter(t => t !== tag);
            } else if (!tags.includes(tag)) {
                tags.push(tag);
            }

            await affirmationsService.updateFavoriteMetadata(text, { tags });
            await this.loadFavorites();
        } catch (error) {
            console.error('Failed to update tags:', error);
            throw error;
        }
    }

    showError(message) {
        const listContainer = this.dialog.querySelector('.favorite-affirmations-list');
        listContainer.innerHTML = `
            <div class="error-state glass">
                <i class="material-icons-round error-icon">error_outline</i>
                <h3>Oops!</h3>
                <p>${message}</p>
            </div>
        `;
    }

    show() {
        this.dialog.classList.add('show');
        this.loadFavorites();
    }

    hide() {
        this.dialog.classList.remove('show');
    }
}

const favoritesManager = new FavoritesManager();
export default favoritesManager; 