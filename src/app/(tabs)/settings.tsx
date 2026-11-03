import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useHabits } from '@/hooks/use-habits';
import { confirmAction } from '@/lib/confirm';
import { playFeedback } from '@/lib/feedback';
import { formatTime } from '@/lib/habits';
import {
  hasReminderPermission,
  remindersSupported,
  requestReminderPermission,
} from '@/lib/reminders';

const AccentColor = '#3c87f7';

function timeOptions(times: string[]) {
  return [{ value: null as string | null, label: 'Off' }].concat(
    times.map((value) => ({ value, label: formatTime(value) }))
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </ThemedView>
  );
}

export default function SettingsScreen() {
  const { settings, updateSettings, resetToSampleData, resetEverything, sync, retrySync, signOut } =
    useHabits();
  const { session } = useAuth();
  const [permission, setPermission] = useState<boolean | null>(null);

  useEffect(() => {
    hasReminderPermission().then(setPermission);
  }, []);

  const reminders = settings.reminders;

  return (
    <ScreenScrollView>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Settings</ThemedText>
      </ThemedView>

      <Section title="Feedback">
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <ThemedText>Sounds</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Chimes when you log and finish habits
            </ThemedText>
          </View>
          <Switch
            value={settings.sound}
            onValueChange={(sound) => {
              updateSettings({ sound });
              if (sound) playFeedback('complete', { sound });
            }}
          />
        </View>
        <Pressable onPress={() => playFeedback('celebrate', { sound: settings.sound })}>
          <ThemedText type="smallBold" style={{ color: AccentColor }}>
            ▶ Preview celebration
          </ThemedText>
        </Pressable>
      </Section>

      <Section title="Reminders">
        {!remindersSupported ? (
          <ThemedText type="small" themeColor="textSecondary">
            Reminders are delivered by the iOS and Android apps. Times you set here are saved.
          </ThemedText>
        ) : permission === false ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Notifications are off, so reminders can&apos;t reach you.
            </ThemedText>
            <PrimaryButton
              label="Turn on reminders"
              color={AccentColor}
              onPress={async () => setPermission(await requestReminderPermission())}
            />
          </>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          ☀️ Morning check-in
        </ThemedText>
        <ChoiceChips
          color={AccentColor}
          value={reminders.morning}
          onChange={(morning) => updateSettings({ reminders: { ...reminders, morning } })}
          options={timeOptions(['07:00', '08:00', '09:00'])}
        />
        <ThemedText type="small" themeColor="textSecondary">
          🌙 Evening nudge (only if habits are left)
        </ThemedText>
        <ChoiceChips
          color={AccentColor}
          value={reminders.evening}
          onChange={(evening) => updateSettings({ reminders: { ...reminders, evening } })}
          options={timeOptions(['19:00', '20:00', '21:00'])}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Per-habit reminders follow each habit&apos;s “When will you do it?” time.
        </ThemedText>
      </Section>

      <Section title="Data">
        <Pressable
          onPress={() =>
            confirmAction(
              'Load demo data?',
              'This replaces your habits with a month of sample history.',
              'Load',
              resetToSampleData
            )
          }>
          <ThemedText type="smallBold" style={{ color: AccentColor }}>
            Load demo data
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() =>
            confirmAction(
              'Start over?',
              'This erases all habits, history and badges, then shows onboarding again.',
              'Start over',
              resetEverything
            )
          }>
          <ThemedText type="smallBold" style={styles.danger}>
            Start over
          </ThemedText>
        </Pressable>
      </Section>

      <Section title="Account">
        <ThemedText type="small" themeColor="textSecondary">
          Signed in as {session?.user.email}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {sync.status === 'offline'
            ? "⚠️ Can't reach the server. Changes are kept on this device and will sync later."
            : sync.status === 'syncing' || sync.pending > 0
              ? 'Saving to your account…'
              : '✅ Everything is saved to your account.'}
        </ThemedText>
        {sync.status === 'offline' && (
          <Pressable onPress={retrySync}>
            <ThemedText type="smallBold" style={{ color: AccentColor }}>
              Try again
            </ThemedText>
          </Pressable>
        )}
        <Pressable onPress={signOut}>
          <ThemedText type="smallBold" style={{ color: AccentColor }}>
            Sign out
          </ThemedText>
        </Pressable>
      </Section>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.three,
  },
  section: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  switchText: {
    flex: 1,
  },
  danger: {
    color: '#E5484D',
  },
});
