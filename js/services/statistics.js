// Statistics Service Module
import stateManager from '../modules/state.js';
import { requirePremium } from '../utils/premium.js';

class StatisticsError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'StatisticsError';
        this.code = code;
        this.details = details;
    }
}

class StatisticsService {
    constructor() {
        this.defaultStats = {
            totalViews: 0,
            favorites: {},
            categories: {},
            dailyStreak: 0,
            lastViewed: null,
            viewHistory: [],
            mostViewed: [],
            leastViewed: []
        };
    }

    // Get all statistics
    async getStatistics() {
        try {
            return await requirePremium('affirmation_stats', async () => {
                const settings = stateManager.getSettings();
                return settings.statistics || this.defaultStats;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new StatisticsError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new StatisticsError(
                'Failed to get statistics',
                'GET_STATS_ERROR',
                { originalError: error }
            );
        }
    }

    // Track affirmation view
    async trackView(affirmationId) {
        try {
            return await requirePremium('affirmation_stats', async () => {
                const settings = stateManager.getSettings();
                const stats = settings.statistics || this.defaultStats;
                const now = new Date();

                // Update total views
                const totalViews = stats.totalViews + 1;

                // Update view history
                const viewHistory = [
                    {
                        affirmationId,
                        timestamp: now.toISOString()
                    },
                    ...(stats.viewHistory || [])
                ].slice(0, 100); // Keep last 100 views

                // Update daily streak
                let dailyStreak = stats.dailyStreak || 0;
                const lastViewed = stats.lastViewed ? new Date(stats.lastViewed) : null;
                
                if (lastViewed) {
                    const daysSinceLastView = Math.floor(
                        (now - lastViewed) / (1000 * 60 * 60 * 24)
                    );
                    
                    if (daysSinceLastView <= 1) {
                        // If viewed today or yesterday, increment streak
                        dailyStreak++;
                    } else {
                        // Reset streak if more than a day has passed
                        dailyStreak = 1;
                    }
                } else {
                    // First view
                    dailyStreak = 1;
                }

                // Update affirmation-specific stats
                const affirmationStats = {
                    ...(stats.affirmations || {}),
                    [affirmationId]: {
                        views: ((stats.affirmations || {})[affirmationId]?.views || 0) + 1,
                        lastViewed: now.toISOString()
                    }
                };

                // Calculate most and least viewed
                const sortedAffirmations = Object.entries(affirmationStats)
                    .map(([id, stats]) => ({
                        id,
                        views: stats.views
                    }))
                    .sort((a, b) => b.views - a.views);

                const mostViewed = sortedAffirmations.slice(0, 10);
                const leastViewed = sortedAffirmations.reverse().slice(0, 10);

                const updatedStats = {
                    ...stats,
                    totalViews,
                    viewHistory,
                    dailyStreak,
                    lastViewed: now.toISOString(),
                    affirmations: affirmationStats,
                    mostViewed,
                    leastViewed
                };

                await stateManager.updateSettings({
                    statistics: updatedStats
                });

                return updatedStats;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new StatisticsError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new StatisticsError(
                'Failed to track view',
                'TRACK_VIEW_ERROR',
                { originalError: error }
            );
        }
    }

    // Get view history
    async getViewHistory(limit = 100) {
        try {
            return await requirePremium('affirmation_stats', async () => {
                const stats = await this.getStatistics();
                return (stats.viewHistory || []).slice(0, limit);
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new StatisticsError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new StatisticsError(
                'Failed to get view history',
                'GET_HISTORY_ERROR',
                { originalError: error }
            );
        }
    }

    // Get daily streak
    async getDailyStreak() {
        try {
            return await requirePremium('affirmation_stats', async () => {
                const stats = await this.getStatistics();
                return stats.dailyStreak || 0;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new StatisticsError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new StatisticsError(
                'Failed to get daily streak',
                'GET_STREAK_ERROR',
                { originalError: error }
            );
        }
    }

    // Get most viewed affirmations
    async getMostViewed(limit = 10) {
        try {
            return await requirePremium('affirmation_stats', async () => {
                const stats = await this.getStatistics();
                return (stats.mostViewed || []).slice(0, limit);
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new StatisticsError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new StatisticsError(
                'Failed to get most viewed',
                'GET_MOST_VIEWED_ERROR',
                { originalError: error }
            );
        }
    }

    // Get least viewed affirmations
    async getLeastViewed(limit = 10) {
        try {
            return await requirePremium('affirmation_stats', async () => {
                const stats = await this.getStatistics();
                return (stats.leastViewed || []).slice(0, limit);
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new StatisticsError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new StatisticsError(
                'Failed to get least viewed',
                'GET_LEAST_VIEWED_ERROR',
                { originalError: error }
            );
        }
    }

    // Get affirmation-specific statistics
    async getAffirmationStats(affirmationId) {
        try {
            return await requirePremium('affirmation_stats', async () => {
                const stats = await this.getStatistics();
                return (stats.affirmations || {})[affirmationId] || {
                    views: 0,
                    lastViewed: null
                };
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new StatisticsError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new StatisticsError(
                'Failed to get affirmation stats',
                'GET_AFFIRMATION_STATS_ERROR',
                { originalError: error }
            );
        }
    }

    // Reset statistics
    async resetStatistics() {
        try {
            return await requirePremium('affirmation_stats', async () => {
                await stateManager.updateSettings({
                    statistics: this.defaultStats
                });
                return this.defaultStats;
            });
        } catch (error) {
            if (error.message === 'Premium feature not available') {
                throw new StatisticsError('Premium feature not available', 'PREMIUM_REQUIRED');
            }
            throw new StatisticsError(
                'Failed to reset statistics',
                'RESET_STATS_ERROR',
                { originalError: error }
            );
        }
    }
}

// Create and export singleton instance
const statisticsService = new StatisticsService();
export default statisticsService;
export { StatisticsError }; 