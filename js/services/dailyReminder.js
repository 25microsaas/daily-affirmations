// Daily Reminder Service
import { showNotification } from '../utils/common.js';
import { requirePremium } from '../utils/premium.js';
import stateManager from '../modules/state.js';

class DailyReminderService {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            // Initialize reminder settings if not present
            const settings = stateManager.getSettings();
            const currentReminder = settings.dailyReminder || {};

            // Ensure all required fields are present with defaults
            const defaultReminder = {
                enabled: false,
                days: ['mon', 'tue', 'wed', 'thu', 'fri'],
                times: ['09:00'],
                message: 'Time for your daily affirmation!',
                lastNotified: null,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            // Merge current settings with defaults, preserving enabled state
            const mergedReminder = {
                ...defaultReminder,
                ...currentReminder,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone // Always use current timezone
            };

            // Save the merged settings
            await stateManager.updateSettings({
                dailyReminder: mergedReminder
            });

            // Set up alarms if reminders are enabled
            if (mergedReminder.enabled) {
                await this.setupAlarms(mergedReminder);
            }

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize daily reminder service:', error);
            throw error;
        }
    }

    getLocalTime(time, timezone) {
        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();

        // Create a date string with the target time in the local timezone
        const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

        // Create a date object in the target timezone
        const targetDate = new Date(dateString);

        // Get the time difference between local and target timezone
        const targetOffset = targetDate.getTimezoneOffset();
        const localOffset = new Date().getTimezoneOffset();
        const offsetDiff = targetOffset - localOffset;

        // Adjust the time by the offset difference
        targetDate.setMinutes(targetDate.getMinutes() - offsetDiff);

        return targetDate;
    }

    async setupAlarms(reminder) {
        try {
            const alarms = await chrome.alarms.getAll();

            for (const alarm of alarms) {
                if (alarm.name.startsWith('reminder_')) {
                    await chrome.alarms.clear(alarm.name);
                }
            }

            if (!reminder.enabled) {
                return;
            }

            // Create alarms for each time
            reminder.times.forEach((time, index) => {
                const targetTime = this.getLocalTime(time, reminder.timezone);
                const now = new Date();

                // If time has passed today, schedule for tomorrow
                if (targetTime <= now) {
                    targetTime.setDate(targetTime.getDate() + 1);
                }

                chrome.alarms.create(`reminder_${index}`, {
                    when: targetTime.getTime(),
                    periodInMinutes: 24 * 60 // Repeat daily
                });

            });

            // Verify alarms were created
            const newAlarms = await chrome.alarms.getAll();
        } catch (error) {
            console.error('Failed to setup alarms:', error);
            throw error;
        }
    }

    async updateSettings(settings) {
        try {
            const currentSettings = stateManager.getSettings();

            // Reset lastNotified when enabling reminders
            if (settings.enabled && !currentSettings.dailyReminder?.enabled) {
                settings.lastNotified = null;
            }

            const updatedSettings = {
                dailyReminder: {
                    ...currentSettings.dailyReminder,
                    ...settings,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone // Always use current timezone
                }
            };

            await stateManager.updateSettings(updatedSettings);

            // Set up alarms with new settings
            await this.setupAlarms(updatedSettings.dailyReminder);
        } catch (error) {
            console.error('Failed to update settings:', error);
            throw error;
        }
    }

    cleanup() {
        // Clear all reminder alarms
        chrome.alarms.getAll().then(alarms => {
            alarms.forEach(alarm => {
                if (alarm.name.startsWith('reminder_')) {
                    chrome.alarms.clear(alarm.name);
                }
            });
        });
    }
}

export default new DailyReminderService(); 