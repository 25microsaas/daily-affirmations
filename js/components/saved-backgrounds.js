// Saved Backgrounds Manager Component
import backgroundService from '../services/background.js';
import { showNotification } from '../utils/common.js';
import { requirePremium } from '../utils/premium.js';
import stateManager from '../modules/state.js';

class SavedBackgroundsManager {
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
        this.dialog.className = 'backgrounds-dialog';
        this.dialog.innerHTML = `
            <div class="dialog-content glass">
                <div class="dialog-header">
                    <h2>Saved Backgrounds</h2>
                    <div class="header-actions">
                        ${backgroundService.isFixedBackground() ? `
                            <button class="unselect-button" title="Return to random backgrounds">
                                <i class="material-icons-round">shuffle</i>
                                Random Mode
                            </button>
                        ` : ''}
                        <button class="close-button" title="Close dialog">
                            <i class="material-icons-round">close</i>
                        </button>
                    </div>
                </div>
                <div class="backgrounds-content">
                    <div class="backgrounds-actions">
                        <button class="add-background-button" title="Add a custom background image">
                            <i class="material-icons-round">add_photo_alternate</i>
                            Add Custom Background
                        </button>
                        <div class="backgrounds-info">
                            <span class="mode-indicator">
                                ${backgroundService.isFixedBackground() ? 'Fixed Background' : 'Random Backgrounds'}
                            </span>
                            <span class="count"></span>
                        </div>
                    </div>
                    <div class="backgrounds-grid"></div>
                </div>
                <div class="backgrounds-empty-state">
                    <i class="material-icons-round">wallpaper</i>
                    <p>No saved backgrounds yet</p>
                    <p class="subtitle">Save backgrounds from Unsplash or add your own custom images</p>
                </div>
            </div>
        `;
        document.body.appendChild(this.dialog);

        // Add event listener for unselect button if it exists
        const unselectButton = this.dialog.querySelector('.unselect-button');
        if (unselectButton) {
            unselectButton.addEventListener('click', async () => {
                try {
                    unselectButton.disabled = true;
                    const originalHTML = unselectButton.innerHTML;
                    unselectButton.innerHTML = '<i class="material-icons-round">hourglass_top</i> Switching...';

                    await backgroundService.unsetCurrentBackground();
                    await this.loadBackgrounds(); // Refresh the grid

                    // Update mode indicator
                    const modeIndicator = this.dialog.querySelector('.mode-indicator');
                    if (modeIndicator) {
                        modeIndicator.textContent = 'Random Backgrounds';
                    }

                    // Remove the unselect button
                    unselectButton.remove();
                } catch (error) {
                    console.error('Failed to unset background:', error);
                    showNotification('Error', 'Failed to switch to random mode');
                } finally {
                    if (unselectButton.parentNode) { // If button still exists
                        unselectButton.disabled = false;
                        unselectButton.innerHTML = originalHTML;
                    }
                }
            });
        }
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

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.dialog.classList.contains('show')) {
                this.hide();
            }
        });

        // Add custom background
        const addButton = this.dialog.querySelector('.add-background-button');
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        this.dialog.appendChild(fileInput);

        addButton.addEventListener('click', async () => {
            try {
                await requirePremium('custom_backgrounds', () => {
                    fileInput.click();
                });
            } catch (error) {
                if (error.message === 'Premium feature not available') {
                    showNotification('Premium Required', 'Upgrade to Pro to add custom backgrounds');
                }
            }
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                addButton.disabled = true;
                addButton.innerHTML = '<i class="material-icons-round">hourglass_top</i> Uploading...';

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        await backgroundService.addCustomBackground(event.target.result);
                        await this.loadBackgrounds();
                        showNotification('Success', 'Custom background added');
                    } catch (error) {
                        showNotification('Error', error.message || 'Failed to add custom background');
                    } finally {
                        addButton.disabled = false;
                        addButton.innerHTML = '<i class="material-icons-round">add_photo_alternate</i> Add Custom Background';
                        fileInput.value = ''; // Reset file input
                    }
                };
                reader.readAsDataURL(file);
            } catch (error) {
                showNotification('Error', 'Failed to read image file');
                addButton.disabled = false;
                addButton.innerHTML = '<i class="material-icons-round">add_photo_alternate</i> Add Custom Background';
            }
        });
    }

    async loadBackgrounds() {
        const gridContainer = this.dialog.querySelector('.backgrounds-grid');
        const emptyState = this.dialog.querySelector('.backgrounds-empty-state');
        const countElement = this.dialog.querySelector('.backgrounds-info .count');
        const modeIndicator = this.dialog.querySelector('.mode-indicator');
        
        try {
            const settings = stateManager.getSettings();
            const customBackgrounds = settings.customBackgrounds || [];
            const defaultBackgrounds = backgroundService.defaultBackgrounds;
            const allBackgrounds = [...defaultBackgrounds, ...customBackgrounds];
            const currentBackground = settings.currentBackground;
            const isFixedMode = settings.backgroundMode === 'fixed';

            // Update count and mode
            const savedCount = customBackgrounds.length;
            countElement.textContent = `${savedCount} saved background${savedCount !== 1 ? 's' : ''}`;
            modeIndicator.textContent = isFixedMode ? 'Fixed Background' : 'Random Backgrounds';

            if (!allBackgrounds.length) {
                gridContainer.style.display = 'none';
                emptyState.style.display = 'flex';
                return;
            }

            gridContainer.style.display = 'grid';
            emptyState.style.display = 'none';

            gridContainer.innerHTML = allBackgrounds.map(bg => {
                const isCurrentBackground = currentBackground && bg.id === currentBackground.id;
                const isDefaultBackground = typeof bg.id === 'string' && bg.id.startsWith('default_');
                
                return `
                    <div class="background-item ${isCurrentBackground ? 'current' : ''}" data-id="${bg.id}">
                        <div class="background-preview" style="background-image: url(${bg.url})">
                            ${isCurrentBackground ? `
                                <div class="current-badge">
                                    ${isFixedMode ? 'Current' : 'Last Used'}
                                </div>
                            ` : ''}
                            <div class="background-actions">
                                <button class="action-icon" data-action="use" 
                                    title="${isCurrentBackground ? 
                                        (isFixedMode ? 'Current background' : 'Set as fixed background') : 
                                        'Use this background'}">
                                    <i class="material-icons-round">
                                        ${isCurrentBackground ? 
                                            (isFixedMode ? 'check_circle' : 'push_pin') : 
                                            'wallpaper'}
                                    </i>
                                </button>
                                ${!isDefaultBackground ? `
                                    <button class="action-icon" data-action="remove" title="Remove from saved backgrounds">
                                        <i class="material-icons-round">delete</i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="background-credit">
                            ${bg.credit || 'Custom Background'}
                            ${bg.savedAt ? `<br><small>Saved ${new Date(bg.savedAt).toLocaleDateString()}</small>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            // Add event listeners for actions
            gridContainer.querySelectorAll('.action-icon').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const action = button.dataset.action;
                    const backgroundItem = button.closest('.background-item');
                    const backgroundId = backgroundItem?.dataset.id;
                    const background = allBackgrounds.find(bg => String(bg.id) === backgroundId);

                    if (!background) return;

                    try {
                        const originalHTML = button.innerHTML;
                        button.disabled = true;
                        button.innerHTML = '<i class="material-icons-round">hourglass_top</i>';

                        switch (action) {
                            case 'use':
                                if (backgroundItem.classList.contains('current')) {
                                    // If it's the current background, unset it
                                    await backgroundService.unsetCurrentBackground();
                                    await this.loadBackgrounds();
                                    showNotification('Success', 'Switched to random backgrounds mode');
                                } else {
                                    // If it's not current, set it as fixed
                                    await backgroundService.updateBackgroundDisplay(background, true);
                                    await this.loadBackgrounds();
                                    showNotification('Success', 'Background has been set as fixed background');
                                }
                                break;

                            case 'remove':
                                if (background.id.startsWith('default_')) return;
                                
                                const updatedBackgrounds = customBackgrounds.filter(bg => bg.id !== background.id);
                                await stateManager.updateSettings({ customBackgrounds: updatedBackgrounds });
                                
                                if (currentBackground && background.id === currentBackground.id) {
                                    await backgroundService.unsetCurrentBackground();
                                }
                                
                                await this.loadBackgrounds();
                                showNotification('Success', 'Background has been removed from saved backgrounds');
                                break;
                        }

                        button.disabled = false;
                        button.innerHTML = originalHTML;
                    } catch (error) {
                        console.error('Failed to perform background action:', error);
                        showNotification('Error', 'Failed to perform action');
                        button.disabled = false;
                        button.innerHTML = originalHTML;
                    }
                });
            });
        } catch (error) {
            console.error('Failed to load backgrounds:', error);
            showNotification('Error', 'Failed to load backgrounds');
        }
    }

    show() {
        this.dialog.classList.add('show');
        this.loadBackgrounds();
    }

    hide() {
        this.dialog.classList.remove('show');
    }
}

const savedBackgroundsManager = new SavedBackgroundsManager();
export default savedBackgroundsManager; 