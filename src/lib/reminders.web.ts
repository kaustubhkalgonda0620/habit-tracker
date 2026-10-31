// expo-notifications can't schedule local notifications on web, so reminders are native-only.
import type { Challenge } from '@/lib/challenges';
import type { Habit } from '@/lib/habits';
import type { ReminderSettings } from '@/lib/reminder-plan';

export const remindersSupported = false;

export async function hasReminderPermission(): Promise<boolean> {
  return false;
}

export async function requestReminderPermission(): Promise<boolean> {
  return false;
}

export async function syncReminders(
  _habits: Habit[],
  _challenge: Challenge | null,
  _settings: ReminderSettings
) {}
