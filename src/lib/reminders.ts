import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Challenge } from '@/lib/challenges';
import type { Habit } from '@/lib/habits';
import { planReminders, type ReminderSettings } from '@/lib/reminder-plan';

export const remindersSupported = true;

const ChannelId = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ChannelId, {
    name: 'Habit reminders',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function hasReminderPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

export async function requestReminderPermission(): Promise<boolean> {
  // Android 13+ only shows the prompt once a channel exists.
  await ensureChannel();
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

async function replaceScheduled(habits: Habit[], challenge: Challenge | null, settings: ReminderSettings) {
  if (!(await hasReminderPermission())) return;
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const item of planReminders(habits, challenge, settings, new Date())) {
    await Notifications.scheduleNotificationAsync({
      content: { title: item.title, body: item.body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.date,
        channelId: ChannelId,
      },
    });
  }
}

// Syncs run one at a time; if several are requested while one runs, only the newest runs next.
// Overlapping cancel/schedule passes would otherwise leave duplicate reminders.
let running: Promise<void> | null = null;
let queued: (() => Promise<void>) | null = null;

async function drain() {
  while (queued) {
    const next = queued;
    queued = null;
    await next().catch(() => {});
  }
  running = null;
}

/**
 * Replaces every scheduled reminder with a fresh plan for the next few days.
 * Called whenever habits change, so finished habits stop nagging immediately.
 */
export function syncReminders(habits: Habit[], challenge: Challenge | null, settings: ReminderSettings) {
  queued = () => replaceScheduled(habits, challenge, settings);
  running ??= drain();
  return running;
}
