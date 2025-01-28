import affirmationsService from '../services/affirmations.js';
import { showNotification } from '../utils/notifications.js';
import { requirePremium } from '../utils/premium.js';
import favoritesManager from '../components/favorites-manager.js';

export function setupAffirmationActions() {
    const menuButton = document.querySelector('.affirmation-menu-button');
    const actionsContainer = document.querySelector('.affirmation-actions');
    
    if (!menuButton || !actionsContainer) {
        console.error('Affirmation action elements not found');
        return;
    }

    // Toggle actions visibility
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        actionsContainer.classList.toggle('show');
    });

    // Close actions when clicking outside
    document.addEventListener('click', (e) => {
        if (!actionsContainer.contains(e.target) && !menuButton.contains(e.target)) {
            actionsContainer.classList.remove('show');
        }
    });

    // Handle action buttons
    actionsContainer.addEventListener('click', async (e) => {
        const actionButton = e.target.closest('.action-button');
        if (!actionButton) return;

        const action = actionButton.dataset.action;
        const affirmationText = document.getElementById('affirmation')?.textContent;

        try {
            switch (action) {
                case 'refresh':
                    await affirmationsService.update();
                    break;
                
                case 'copy':
                    if (affirmationText) {
                        await navigator.clipboard.writeText(affirmationText);
                        showNotification('Copied!', 'Affirmation copied to clipboard');
                    }
                    break;
                
                case 'favorite':
                    if (affirmationText) {
                        await requirePremium('favorite_affirmations', async () => {
                            const isFavorited = await affirmationsService.isFavorited(affirmationText);
                            const icon = actionButton.querySelector('.material-icons-round');
                            const buttonText = actionButton.querySelector('span');
                            
                            if (isFavorited) {
                                await affirmationsService.removeFromFavorites(affirmationText);
                                if (icon) icon.textContent = 'favorite_border';
                                if (buttonText) buttonText.textContent = 'Add to Favorites';
                                actionButton.classList.remove('active');
                                showNotification('Removed from Favorites', 'Affirmation removed from your favorites list');
                            } else {
                                await affirmationsService.addToFavorites(affirmationText);
                                if (icon) icon.textContent = 'favorite';
                                if (buttonText) buttonText.textContent = 'Remove from Favorites';
                                actionButton.classList.add('active');
                                showNotification('Added to Favorites', 'Affirmation saved to your favorites list');
                            }
                        });
                    }
                    break;

                case 'manage-favorites':
                    await requirePremium('favorite_affirmations', async () => {
                        favoritesManager.show();
                    });
                    break;

                case 'share':
                    if (affirmationText) {
                        console.log('Sharing affirmation:', affirmationText);
                        await requirePremium('share_affirmations', async () => {
                            try {
                                console.log('Sharing affirmation DEEP:', affirmationText);
                                if (navigator.share) {
                                    await navigator.share({
                                        title: 'Daily Affirmation',
                                        text: affirmationText
                                    });
                                    showNotification('Shared!', 'Affirmation shared successfully');
                                } else {
                                    await navigator.clipboard.writeText(affirmationText);
                                    showNotification('Copied!', 'Affirmation copied for sharing');
                                }
                            } catch (error) {
                                if (error.name !== 'AbortError') {
                                    console.error('Error sharing:', error);
                                    showNotification('Error', 'Failed to share affirmation');
                                }
                            }
                        });
                    }
                    break;
            }
        } catch (error) {
            // Only log the error, don't show notification for AbortError or Premium errors
            if (error.name !== 'AbortError' && error.message !== 'Premium feature not available') {
                console.error('Error handling affirmation action:', error);
                showNotification('Error', 'Failed to perform action');
            }
        }

        // Close actions after performing action
        actionsContainer.classList.remove('show');
    });

    // Initialize favorite button state
    const updateFavoriteState = async () => {
        const affirmationText = document.getElementById('affirmation')?.textContent;
        if (affirmationText) {
            const favoriteButton = document.querySelector('[data-action="favorite"]');
            const isFavorited = await affirmationsService.isFavorited(affirmationText);
            if (favoriteButton) {
                const icon = favoriteButton.querySelector('.material-icons-round');
                const buttonText = favoriteButton.querySelector('span');
                if (icon) {
                    icon.textContent = isFavorited ? 'favorite' : 'favorite_border';
                }
                if (buttonText) {
                    buttonText.textContent = isFavorited ? 'Remove from Favorites' : 'Add to Favorites';
                }
                favoriteButton.classList.toggle('active', isFavorited);
            }
        }
    };

    // Update favorite state when affirmation changes
    const observer = new MutationObserver(updateFavoriteState);
    const affirmationElement = document.getElementById('affirmation');
    if (affirmationElement) {
        observer.observe(affirmationElement, { childList: true });
        updateFavoriteState();
    }
} 