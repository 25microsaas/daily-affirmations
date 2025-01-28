import { showNotification } from '../utils/common.js';
import backupService from '../services/backup.js';

class BackupRestoreDialog {
    constructor() {
        this.dialog = document.getElementById('backupDialog');
        this.closeButton = this.dialog?.querySelector('.close-button');
        this.downloadButton = this.dialog?.querySelector('.backup-button.primary');
        this.restoreButton = this.dialog?.querySelector('.backup-button.secondary');
        this.lastBackupTime = this.dialog?.querySelector('.last-backup-time');
        this.statusBox = this.dialog?.querySelector('.status-box');
        this.cloudSyncStatus = this.dialog?.querySelector('.cloud-sync-status');
    }

    async initialize() {
        if (!this.dialog) {
            console.error('Backup dialog not found');
            return;
        }
        
        this.setupEventListeners();
        await this.updateLastBackupTime();
        await this.updateCloudSyncStatus();

        // Update cloud sync status periodically
        setInterval(() => this.updateCloudSyncStatus(), 30000); // Every 30 seconds
    }

    setupEventListeners() {
        if (!this.dialog) return;

        // Close button
        this.closeButton?.addEventListener('click', () => this.hide());

        // Click outside to close
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.hide();
            }
        });

        // Download backup
        this.downloadButton?.addEventListener('click', async () => {
            try {
                await backupService.exportBackup();
                showNotification('Success', 'Backup created successfully');
                await this.updateLastBackupTime();
                this.updateStatus('success', 'Last backup completed successfully');
            } catch (error) {
                console.error('Failed to create backup:', error);
                showNotification('Error', 'Failed to create backup');
                this.updateStatus('error', 'Backup failed');
            }
        });

        // Restore backup
        this.restoreButton?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    await backupService.importBackup(file);
                    showNotification('Success', 'Backup restored successfully');
                    this.updateStatus('success', 'Backup restored successfully');
                    
                    // Sync changes to cloud
                    await backupService.syncToCloud();
                    await this.updateCloudSyncStatus();
                    
                    window.location.reload(); // Reload to apply changes
                } catch (error) {
                    console.error('Failed to restore backup:', error);
                    showNotification('Error', 'Failed to restore backup');
                    this.updateStatus('error', 'Restore failed');
                }
            });

            input.click();
        });

        // Manual cloud sync
        this.cloudSyncStatus?.addEventListener('click', async () => {
            try {
                await backupService.syncToCloud();
                await this.updateCloudSyncStatus();
                showNotification('Success', 'Manual sync completed');
            } catch (error) {
                console.error('Failed to sync:', error);
                showNotification('Error', 'Failed to sync with cloud');
            }
        });
    }

    show() {
        this.dialog?.classList.add('show');
        this.updateLastBackupTime();
        this.updateCloudSyncStatus();
    }

    hide() {
        this.dialog?.classList.remove('show');
    }

    async updateLastBackupTime() {
        if (!this.lastBackupTime) return;

        try {
            const history = await backupService.getBackupHistory();
            const lastBackup = history[0]?.timestamp;
            
            if (lastBackup) {
                const date = new Date(lastBackup);
                this.lastBackupTime.textContent = `Last backup: Today at ${date.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                })}`;
            } else {
                this.lastBackupTime.textContent = 'No backups yet';
            }
        } catch (error) {
            console.error('Failed to update last backup time:', error);
            this.lastBackupTime.textContent = 'Last backup: Unknown';
        }
    }

    async updateCloudSyncStatus() {
        if (!this.cloudSyncStatus) return;

        const lastSync = backupService.getLastSyncTime();
        if (lastSync) {
            const timeAgo = this.getTimeAgo(lastSync);
            this.cloudSyncStatus.innerHTML = `
                <i class="material-icons-round">cloud_done</i>
                <p>Last synced ${timeAgo}</p>
            `;
            this.cloudSyncStatus.title = 'Click to sync now';
            this.cloudSyncStatus.style.cursor = 'pointer';
        } else {
            this.cloudSyncStatus.innerHTML = `
                <i class="material-icons-round">cloud_sync</i>
                <p>Click to start cloud sync</p>
            `;
            this.cloudSyncStatus.style.cursor = 'pointer';
        }
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    }

    updateStatus(type, message) {
        if (!this.statusBox) return;
        
        this.statusBox.className = `status-box ${type}`;
        const messageElement = this.statusBox.querySelector('p');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }
}

const backupRestoreDialog = new BackupRestoreDialog();
export default backupRestoreDialog; 