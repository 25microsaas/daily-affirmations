// Daily Reminder Settings Component
import { showNotification } from '../utils/common.js';
import { requirePremium } from '../utils/premium.js';
import dailyReminderService from '../services/dailyReminder.js';
import stateManager from '../modules/state.js';

class ReminderSettings {
    constructor() {
        this.initialized = false;
        this.container = null;
        this.weekdays = [
            { id: 'mon', label: 'Mon' },
            { id: 'tue', label: 'Tue' },
            { id: 'wed', label: 'Wed' },
            { id: 'thu', label: 'Thu' },
            { id: 'fri', label: 'Fri' },
            { id: 'sat', label: 'Sat' },
            { id: 'sun', label: 'Sun' }
        ];
    }

    async initialize() {
        if (this.initialized) return;

        this.container = document.createElement('div');
        this.container.className = 'reminder-settings hidden';
        this.container.innerHTML = `
            <div class="reminder-settings-content menu-panel glass">
                <div class="reminder-header">
                    <h3>Daily Reminders</h3>
                    <button class="close-button material-icons-round">close</button>
                </div>
                
                <div class="reminder-body">
                    <div class="reminder-enable">
                        <label class="switch">
                            <input type="checkbox" id="enableReminder">
                            <span class="slider"></span>
                        </label>
                        <span>Enable Daily Reminders</span>
                    </div>

                    <div class="reminder-test">
                        <button class="test-reminder-btn" id="testReminderBtn">
                            Test Notification
                        </button>
                    </div>

                    <div class="reminder-days">
                        <label>Repeat on</label>
                        <div class="weekday-toggles">
                            ${this.weekdays.map(day => `
                                <button class="weekday-btn" data-day="${day.id}">
                                    ${day.label}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="reminder-times">
                        <label>Reminder Times</label>
                        <div class="time-list" id="timeList"></div>
                        <button class="add-time-btn">
                            <span class="material-icons-round">add</span>
                            Add Time
                        </button>
                    </div>

                    <div class="reminder-message">
                        <label>Custom Message</label>
                        <input type="text" id="reminderMessage" 
                               placeholder="Time for your daily affirmation!"
                               maxlength="100">
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .reminder-settings {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s, visibility 0.3s;
                backdrop-filter: blur(8px);
            }

            .reminder-settings.visible {
                opacity: 1;
                visibility: visible;
            }

            .reminder-settings-content {
                width: 90%;
                max-width: 500px;
                padding: 32px;
                border-radius: 16px;
                max-height: 90vh;
                overflow-y: auto;
                background: rgba(23, 23, 23, 0.95);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .reminder-header {
                display: flex;
                align-items: center;
                margin-bottom: 32px;
                padding-bottom: 16px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .reminder-header h3 {
                margin: 0;
                flex-grow: 1;
                font-size: 1.5rem;
                font-weight: 600;
                color: #fff;
            }

            .reminder-header .close-button {
                background: none;
                border: none;
                cursor: pointer;
                padding: 8px;
                color: var(--color-text-primary);
                opacity: 0.7;
                transition: all 0.2s;
                border-radius: 50%;
            }

            .reminder-header .close-button:hover {
                opacity: 1;
                background: rgba(255, 255, 255, 0.1);
            }

            .reminder-body > div {
                margin-bottom: 32px;
            }

            .reminder-enable {
                display: flex;
                align-items: center;
                gap: 16px;
            }

            /* Modern Switch Style */
            .switch {
                position: relative;
                display: inline-block;
                width: 52px;
                height: 28px;
            }

            .switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(255, 255, 255, 0.1);
                transition: .3s;
                border-radius: 34px;
            }

            .slider:before {
                position: absolute;
                content: "";
                height: 20px;
                width: 20px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: .3s;
                border-radius: 50%;
            }

            input:checked + .slider {
                background-color: #10B981;
            }

            input:checked + .slider:before {
                transform: translateX(24px);
            }

            /* Test Notification Button */
            .test-reminder-btn {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: var(--color-text-primary);
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 0.9rem;
            }

            .test-reminder-btn:hover {
                background: rgba(255, 255, 255, 0.12);
                border-color: rgba(255, 255, 255, 0.2);
            }

            .weekday-toggles {
                display: flex;
                gap: 8px;
                margin-top: 12px;
                flex-wrap: wrap;
            }

            .weekday-btn {
                background: rgba(255, 255, 255, 0.08);
                border: none;
                color: var(--color-text-primary);
                padding: 10px 16px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 0.9rem;
            }

            .weekday-btn.active {
                background: #10B981;
                color: white;
            }

            .weekday-btn:hover:not(.active) {
                background: rgba(255, 255, 255, 0.12);
            }

            .time-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin: 16px 0;
            }

            .time-item {
                display: flex;
                align-items: center;
                gap: 12px;
                background: rgba(255, 255, 255, 0.08);
                padding: 12px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .time-item input[type="time"] {
                background: none;
                border: none;
                color: var(--color-text-primary);
                padding: 8px;
                border-radius: 6px;
                flex-grow: 1;
                font-size: 0.95rem;
            }

            .time-item input[type="time"]::-webkit-calendar-picker-indicator {
                filter: invert(1);
            }

            .time-item .remove-time {
                background: none;
                border: none;
                color: var(--color-text-primary);
                cursor: pointer;
                opacity: 0.7;
                transition: all 0.2s;
                padding: 8px;
                border-radius: 6px;
            }

            .time-item .remove-time:hover {
                opacity: 1;
                color: #EF4444;
                background: rgba(239, 68, 68, 0.1);
            }

            .add-time-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(255, 255, 255, 0.08);
                border: none;
                color: var(--color-text-primary);
                padding: 12px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                width: 100%;
                justify-content: center;
                font-size: 0.95rem;
            }

            .add-time-btn:hover {
                background: rgba(255, 255, 255, 0.12);
            }

            #reminderMessage {
                width: 100%;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: var(--color-text-primary);
                padding: 12px;
                border-radius: 8px;
                font-size: 0.95rem;
                transition: all 0.2s;
            }

            #reminderMessage:focus {
                outline: none;
                border-color: #10B981;
                background: rgba(255, 255, 255, 0.12);
            }

            label {
                display: block;
                margin-bottom: 8px;
                color: rgba(255, 255, 255, 0.7);
                font-size: 0.9rem;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.container);

        this.setupEventListeners();
        this.loadSettings();
        this.initialized = true;
    }

    async loadSettings() {
        const settings = stateManager.getSettings();
        const reminder = settings.dailyReminder || {};

        // Set enabled state
        const enableCheckbox = document.getElementById('enableReminder');
        enableCheckbox.checked = reminder.enabled || false;

        // Check notification permission status
        const permissionStatus = await this.checkNotificationPermission();
        const permissionMessage = document.createElement('div');
        permissionMessage.className = 'notification-permission-message';
        
        if (permissionStatus.systemPermission === 'denied') {
            permissionMessage.innerHTML = `
                <div class="permission-warning">
                    <i class="material-icons-round">warning</i>
                    <span>Notifications are blocked in System Settings. Please enable them to receive daily affirmations.</span>
                </div>
                <button class="open-settings-btn">
                    <i class="material-icons-round">settings</i>
                    Open System Settings
                </button>
            `;
            enableCheckbox.disabled = true;
            enableCheckbox.checked = false;
            
            // Insert after the enable reminder toggle
            const reminderEnable = this.container.querySelector('.reminder-enable');
            reminderEnable.after(permissionMessage);
        }

        // Set other settings
        const days = reminder.days || [];
        this.weekdays.forEach(day => {
            const btn = this.container.querySelector(`[data-day="${day.id}"]`);
            if (btn) {
                btn.classList.toggle('active', days.includes(day.id));
            }
        });

        // Set times
        const timeList = document.getElementById('timeList');
        timeList.innerHTML = '';
        (reminder.times || ['09:00']).forEach(time => {
            this.addTimeInput(time);
        });

        // Set message
        document.getElementById('reminderMessage').value = reminder.message || 'Time for your daily affirmation!';
    }

    async checkNotificationPermission() {
        const results = {
            notificationAPI: 'Notification' in window,
            chromePermission: false,
            systemPermission: null,
            details: []
        };

        // Check Chrome's permission
        try {
            results.chromePermission = await chrome.permissions.contains({
                permissions: ['notifications']
            });
            results.details.push(`Chrome permission: ${results.chromePermission ? 'granted' : 'denied'}`);
        } catch (error) {
            results.details.push(`Chrome permission error: ${error.message}`);
        }

        // Check system permission
        if (results.notificationAPI) {
            results.systemPermission = Notification.permission;
            results.details.push(`System permission: ${results.systemPermission}`);
        } else {
            results.details.push('Notification API not available');
        }

        return results;
    }

    async testNotifications() {
        try {
            const permissionStatus = await this.checkNotificationPermission();
            console.log('Notification Test Results:', permissionStatus);

            if (!permissionStatus.notificationAPI) {
                showNotification('Error', 'Notifications are not supported in this browser');
                return;
            }

            if (!permissionStatus.chromePermission) {
                showNotification('Error', 'Chrome extension needs notification permission');
                return;
            }

            if (permissionStatus.systemPermission !== 'granted') {
                // Try requesting permission
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    showNotification('Error', 'Please enable notifications in your system settings');
                    return;
                }
            }

            // Send test notification directly without premium check
            await chrome.notifications.create('test_notification', {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('images/icon-128.png'),
                title: 'Test Notification',
                message: 'Notifications are working! Upgrade to Pro to get daily affirmation reminders 🎉',
                priority: 2
            });
            
            showNotification('Success', 'Test notification sent! Check your notification center.');
            
        } catch (error) {
            console.error('Notification test failed:', error);
            showNotification('Error', `Test failed: ${error.message}`);
        }
    }

    addTimeInput(time = '') {
        const timeList = document.getElementById('timeList');
        const timeItem = document.createElement('div');
        timeItem.className = 'time-item';
        timeItem.innerHTML = `
            <input type="time" value="${time}" class="time-input">
            <button class="remove-time material-icons-round">remove_circle_outline</button>
        `;

        timeList.appendChild(timeItem);

        // Add event listener for remove button
        timeItem.querySelector('.remove-time').addEventListener('click', () => {
            timeItem.remove();
            this.saveSettings();
        });

        // Add event listener for time input
        timeItem.querySelector('.time-input').addEventListener('change', () => {
            this.saveSettings();
        });
    }

    async saveSettings() {
        try {
            const enabled = document.getElementById('enableReminder').checked;
            const message = document.getElementById('reminderMessage').value;
            
            // Get selected days
            const days = Array.from(this.container.querySelectorAll('.weekday-btn.active'))
                .map(btn => btn.dataset.day);

            // Get times
            const times = Array.from(this.container.querySelectorAll('.time-input'))
                .map(input => input.value)
                .filter(time => time); // Remove empty times

            await dailyReminderService.updateSettings({
                enabled,
                message,
                days,
                times
            });

            showNotification('Settings Saved', 'Reminder settings have been updated');
        } catch (error) {
            console.error('Failed to save reminder settings:', error);
            showNotification('Error', 'Failed to save reminder settings');
        }
    }

    setupEventListeners() {
        // Close button
        this.container.querySelector('.close-button').addEventListener('click', () => {
            this.hide();
        });

        // Test notification button
        document.getElementById('testReminderBtn').addEventListener('click', () => {
            this.testNotifications();
        });

        // Open system settings button (when present)
        this.container.addEventListener('click', (e) => {
            if (e.target.closest('.open-settings-btn')) {
                chrome.tabs.create({
                    url: 'chrome://settings/content/notifications'
                });
            }
        });

        // Enable toggle
        document.getElementById('enableReminder').addEventListener('change', () => {
            this.saveSettings();
        });

        // Weekday toggles
        this.container.querySelectorAll('.weekday-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                this.saveSettings();
            });
        });

        // Add time button
        this.container.querySelector('.add-time-btn').addEventListener('click', () => {
            this.addTimeInput();
        });

        // Message input
        document.getElementById('reminderMessage').addEventListener('change', () => {
            this.saveSettings();
        });

        // Click outside to close
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.hide();
            }
        });
    }

    show() {
        this.container.classList.remove('hidden');
        setTimeout(() => {
            this.container.classList.add('visible');
        }, 10);
    }

    hide() {
        this.container.classList.remove('visible');
        setTimeout(() => {
            this.container.classList.add('hidden');
        }, 300);
    }
}

export default new ReminderSettings(); 