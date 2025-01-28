import BackupRestoreDialog from './backup-restore.js';

class SettingsPanel {
    constructor() {
        this.backupRestoreDialog = new BackupRestoreDialog();
        this.panel = document.getElementById('settingsPanel');
        if (!this.panel) {
            console.error('Settings panel element not found');
            return;
        }
    }

    init() {
        // Get existing content
        const existingContent = this.panel.innerHTML;

        // Add data management section
        const dataManagementSection = `
            <div class="settings-section">
                <h3>Data Management</h3>
                <div class="settings-item">
                    <button class="backup-restore-btn">
                        <i class="material-icons-round">backup</i>
                        Backup & Restore
                        <span class="pro-badge">PRO</span>
                    </button>
                </div>
            </div>
        `;

        // Append data management section to existing content
        this.panel.innerHTML = existingContent + dataManagementSection;

        // Add event listener for backup/restore button
        this.panel.querySelector('.backup-restore-btn')?.addEventListener('click', () => {
            this.backupRestoreDialog.show();
        });
    }
}

export default new SettingsPanel(); 