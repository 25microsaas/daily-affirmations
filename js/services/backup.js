// Backup Service Module
import stateManager from '../modules/state.js';
import { showNotification } from '../utils/common.js';

class BackupError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'BackupError';
        this.code = code;
        this.details = details;
    }
}

class BackupService {
    constructor() {
        this.BACKUP_VERSION = '1.0';
        this.lastSyncTime = null;
        this.setupCloudSync();
    }

    // Setup cloud sync
    async setupCloudSync() {
        try {
            // Listen for changes in sync storage
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'sync' && changes.syncedData) {
                    this.handleSyncedDataChange(changes.syncedData.newValue);
                }
            });

            // Initial sync from cloud
            await this.syncFromCloud();
        } catch (error) {
            console.error('Failed to setup cloud sync:', error);
            // Don't throw here, just log the error
        }
    }

    // Handle synced data changes
    async handleSyncedDataChange(newData) {
        try {
            if (!newData) return;

            const localSettings = stateManager.getSettings();
            const localTimestamp = localSettings.lastSyncTime || '0';
            const cloudTimestamp = newData.timestamp || '0';

            // Only update if cloud data is newer
            if (cloudTimestamp > localTimestamp) {
                await stateManager.updateSettings({
                    ...newData.settings,
                    lastSyncTime: cloudTimestamp
                });
                showNotification('Sync Complete', 'Your settings have been updated from the cloud');
            }
        } catch (error) {
            console.error('Failed to handle synced data change:', error);
        }
    }

    // Sync to cloud
    async syncToCloud() {
        try {
            const settings = await stateManager.getSettings();
            const timestamp = new Date().toISOString();

            const syncData = {
                version: this.BACKUP_VERSION,
                timestamp,
                settings: {
                    ...settings,
                    lastSyncTime: timestamp
                }
            };

            // Save to Chrome sync storage
            await chrome.storage.sync.set({ syncedData: syncData });
            
            // Update local timestamp
            await stateManager.updateSettings({
                lastSyncTime: timestamp
            });

            this.lastSyncTime = new Date(timestamp);
            return true;
        } catch (error) {
            console.error('Failed to sync to cloud:', error);
            // Don't throw here, just return false to indicate failure
            return false;
        }
    }

    // Sync from cloud
    async syncFromCloud() {
        try {
            const result = await chrome.storage.sync.get('syncedData');
            const cloudData = result.syncedData;

            if (!cloudData) {
                // No cloud data yet, sync current settings to cloud
                await this.syncToCloud();
                return true;
            }

            const localSettings = stateManager.getSettings();
            const localTimestamp = localSettings.lastSyncTime || '0';
            const cloudTimestamp = cloudData.timestamp || '0';

            // Only update if cloud data is newer
            if (cloudTimestamp > localTimestamp) {
                await stateManager.updateSettings({
                    ...cloudData.settings,
                    lastSyncTime: cloudTimestamp
                });
                this.lastSyncTime = new Date(cloudTimestamp);
                showNotification('Sync Complete', 'Your settings have been updated from the cloud');
            }

            return true;
        } catch (error) {
            throw new BackupError(
                'Failed to sync from cloud',
                'SYNC_FROM_CLOUD_ERROR',
                { originalError: error }
            );
        }
    }

    // Get last sync time
    getLastSyncTime() {
        return this.lastSyncTime;
    }

    // Create backup data
    async createBackup() {
        try {
            const settings = await stateManager.getSettings();
            const timestamp = new Date().toISOString();

            return {
                version: this.BACKUP_VERSION,
                timestamp,
                data: {
                    settings: {
                        ...settings,
                        backupHistory: undefined // Don't include backup history in backup
                    }
                }
            };
        } catch (error) {
            console.error('Failed to create backup:', error);
            throw new Error('Failed to create backup data');
        }
    }

    // Export backup to file
    async exportBackup() {
        try {
            const backup = await this.createBackup();
            const blob = new Blob([JSON.stringify(backup, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const filename = `affirmations-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);

            return true;
        } catch (error) {
            console.error('Failed to export backup:', error);
            throw new Error('Failed to export backup: ' + error.message);
        }
    }

    // Import backup from file
    async importBackup(file) {
        try {
            const backup = await this.readBackupFile(file);
            
            if (!backup || !backup.data || !backup.data.settings) {
                throw new Error('Invalid backup file format');
            }

            // Update settings
            await stateManager.updateSettings(backup.data.settings);

            // Try to sync to cloud, but don't fail if it doesn't work
            try {
                await this.syncToCloud();
            } catch (syncError) {
                console.warn('Failed to sync restored backup to cloud:', syncError);
                // Continue with the restore process even if sync fails
            }

            return true;
        } catch (error) {
            console.error('Failed to import backup:', error);
            throw new Error('Failed to import backup: ' + error.message);
        }
    }

    // Read backup file
    async readBackupFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const backup = JSON.parse(event.target.result);
                    resolve(backup);
                } catch (error) {
                    reject(new Error('Invalid backup file format'));
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read backup file'));
            reader.readAsText(file);
        });
    }

    // Get backup history
    async getBackupHistory() {
        try {
            const settings = stateManager.getSettings();
            return settings.backupHistory || [];
        } catch (error) {
            throw new BackupError(
                'Failed to get backup history',
                'GET_HISTORY_ERROR',
                { originalError: error }
            );
        }
    }

    // Get last backup time
    getLastBackupTime() {
        try {
            const settings = stateManager.getSettings();
            const lastBackup = settings.backupHistory?.[0]?.timestamp;
            return lastBackup ? new Date(lastBackup) : null;
        } catch (error) {
            console.error('Failed to get last backup time:', error);
            return null;
        }
    }

    // Schedule automatic backups
    async scheduleAutoBackup(intervalHours = 24) {
        try {
            const settings = stateManager.getSettings();
            
            if (settings.autoBackup) {
                const interval = intervalHours * 60 * 60 * 1000;
                
                setInterval(async () => {
                    try {
                        await this.createBackup();
                        showNotification(
                            'Auto Backup',
                            'Your data has been automatically backed up'
                        );
                    } catch (error) {
                        console.error('Auto backup failed:', error);
                    }
                }, interval);

                return true;
            }
            
            return false;
        } catch (error) {
            throw new BackupError(
                'Failed to schedule auto backup',
                'SCHEDULE_BACKUP_ERROR',
                { originalError: error }
            );
        }
    }
}

// Create and export singleton instance
const backupService = new BackupService();
export default backupService;
export { BackupError }; 