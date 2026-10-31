import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ChoiceChips } from '@/components/choice-chips';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHabits } from '@/hooks/use-habits';
import { useTheme } from '@/hooks/use-theme';
import { ChallengeBadges } from '@/lib/challenges';
import { playFeedback, playSelection } from '@/lib/feedback';
import {
  formatTarget,
  formatTime,
  HabitColors,
  SuggestedHabits,
  type NewHabit,
} from '@/lib/habits';
import { type ReminderSettings } from '@/lib/reminder-plan';
import { remindersSupported, requestReminderPermission } from '@/lib/reminders';

const AccentColor = '#3c87f7';
const ChallengeColor = '#F76B15';
const Steps = 4;

function StepDots({ step }: { step: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dots}>
      {Array.from({ length: Steps }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            { backgroundColor: index <= step ? AccentColor : theme.backgroundSelected },
            index === step && styles.dotCurrent,
          ]}
        />
      ))}
    </View>
  );
}

function HabitOption({ habit, selected, onPress }: { habit: NewHabit; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type="backgroundElement"
        style={[styles.option, { borderColor: selected ? habit.color : 'transparent' }]}>
        <View style={[styles.optionEmoji, { backgroundColor: `${habit.color}33` }]}>
          <Text style={styles.emoji}>{habit.emoji}</Text>
        </View>
        <View style={styles.optionText}>
          <ThemedText>{habit.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatTarget(habit)}
            {habit.intentionTime ? ` · ${formatTime(habit.intentionTime)}` : ''}
          </ThemedText>
        </View>
        <View
          style={[
            styles.optionCheck,
            { borderColor: habit.color, backgroundColor: selected ? habit.color : 'transparent' },
          ]}>
          {selected && <Text style={styles.optionCheckMark}>✓</Text>}
        </View>
      </ThemedView>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const { completeOnboarding, settings } = useHabits();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<NewHabit[]>([SuggestedHabits[0], SuggestedHabits[1]]);
  const [customName, setCustomName] = useState('');
  const [reminders, setReminders] = useState<ReminderSettings>(settings.reminders);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const options = [...SuggestedHabits, ...selected.filter((habit) => !SuggestedHabits.includes(habit))];

  function toggle(habit: NewHabit) {
    playSelection();
    setSelected((current) =>
      current.includes(habit) ? current.filter((item) => item !== habit) : [...current, habit]
    );
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    setCustomName('');
    playSelection();
    // Typing an existing name selects that habit rather than adding a duplicate.
    const existing = options.find((habit) => habit.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selected.includes(existing)) setSelected((current) => [...current, existing]);
      return;
    }
    const habit: NewHabit = {
      name,
      emoji: '🌱',
      color: HabitColors[(options.length + 1) % HabitColors.length],
      kind: 'check',
      target: 1,
      intentionTime: null,
    };
    setSelected((current) => [...current, habit]);
  }

  async function askPermission() {
    setPermission((await requestReminderPermission()) ? 'granted' : 'denied');
  }

  function next() {
    playSelection();
    setStep((current) => current + 1);
  }

  function finish() {
    playFeedback('complete', { sound: settings.sound });
    completeOnboarding(selected, reminders);
  }

  return (
    <ScreenScrollView standalone>
      <View style={styles.topBar}>
        {step > 0 ? (
          <Pressable onPress={() => setStep(step - 1)} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Back
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        <StepDots step={step} />
        <View style={styles.topBarSpacer} />
      </View>

      <Animated.View key={step} entering={FadeInDown.duration(350)} style={styles.step}>
        {step === 0 && (
          <>
            <Text style={styles.hero}>✨</Text>
            <ThemedText type="title" style={styles.center}>
              Small habits.{'\n'}Big wins.
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Pick a few habits, log them each day, and celebrate every streak. We&apos;ll start
              you off with a 3-day challenge.
            </ThemedText>
            <PrimaryButton label="Let's go" color={AccentColor} onPress={next} />
          </>
        )}

        {step === 1 && (
          <>
            <ThemedText type="subtitle">Pick your habits</ThemedText>
            <ThemedText themeColor="textSecondary">
              Start small: two or three is plenty. You can change these any time.
            </ThemedText>
            {options.map((habit) => (
              <HabitOption
                key={habit.name}
                habit={habit}
                selected={selected.includes(habit)}
                onPress={() => toggle(habit)}
              />
            ))}
            <View style={styles.customRow}>
              <TextInput
                value={customName}
                onChangeText={setCustomName}
                onSubmitEditing={addCustom}
                placeholder="Add your own…"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="done"
                maxLength={40}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              />
              <Pressable
                onPress={addCustom}
                disabled={!customName.trim()}
                style={[styles.addButton, { backgroundColor: theme.backgroundElement }, !customName.trim() && styles.pressed]}>
                <ThemedText type="smallBold">Add</ThemedText>
              </Pressable>
            </View>
            <PrimaryButton
              label={selected.length ? `Continue with ${selected.length}` : 'Pick at least one'}
              color={AccentColor}
              onPress={next}
              disabled={selected.length === 0}
            />
          </>
        )}

        {step === 2 && (
          <>
            <ThemedText type="subtitle">Stay on track</ThemedText>
            <ThemedText themeColor="textSecondary">
              We&apos;ll check in each morning, nudge you at the times you picked for each habit, and
              remind you in the evening about anything left. Done habits never get nagged.
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.panel}>
              <ThemedText type="smallBold">☀️ Morning check-in</ThemedText>
              <ChoiceChips
                color={AccentColor}
                value={reminders.morning}
                onChange={(morning) => setReminders({ ...reminders, morning })}
                options={[null, '07:00', '08:00', '09:00'].map((value) => ({
                  value,
                  label: value ? formatTime(value) : 'Off',
                }))}
              />
              <ThemedText type="smallBold">🌙 Evening nudge</ThemedText>
              <ChoiceChips
                color={AccentColor}
                value={reminders.evening}
                onChange={(evening) => setReminders({ ...reminders, evening })}
                options={[null, '19:00', '20:00', '21:00'].map((value) => ({
                  value,
                  label: value ? formatTime(value) : 'Off',
                }))}
              />
            </ThemedView>
            {remindersSupported ? (
              permission === 'unknown' ? (
                <PrimaryButton label="Turn on reminders" color={AccentColor} onPress={askPermission} />
              ) : (
                <>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                    {permission === 'granted'
                      ? '✅ Reminders are on.'
                      : 'Reminders are off. You can turn them on later in Settings.'}
                  </ThemedText>
                  <PrimaryButton label="Continue" color={AccentColor} onPress={next} />
                </>
              )
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  Reminders are delivered by the iOS and Android apps. Your times are saved.
                </ThemedText>
                <PrimaryButton label="Continue" color={AccentColor} onPress={next} />
              </>
            )}
            {remindersSupported && permission === 'unknown' && (
              <Pressable onPress={next} style={styles.skip}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Not now
                </ThemedText>
              </Pressable>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.hero}>{ChallengeBadges[3].emoji}</Text>
            <ThemedText type="subtitle" style={styles.center}>
              Your first challenge
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Finish all {selected.length} habit{selected.length === 1 ? '' : 's'} for 3 days in a row
              to earn the “{ChallengeBadges[3].title}” badge. Then level up to 7 and 21 days.
            </ThemedText>
            <View style={styles.challengeDays}>
              {[1, 2, 3].map((day) => (
                <ThemedView key={day} type="backgroundElement" style={styles.challengeDay}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Day
                  </ThemedText>
                  <ThemedText type="subtitle">{day}</ThemedText>
                </ThemedView>
              ))}
            </View>
            <PrimaryButton label="Start my 3-day challenge" color={ChallengeColor} onPress={finish} />
          </>
        )}
      </Animated.View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
  topBarSpacer: {
    width: 32,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotCurrent: {
    width: 24,
  },
  step: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  hero: {
    fontSize: 72,
    lineHeight: 88,
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: 2,
  },
  optionEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
  optionText: {
    flex: 1,
  },
  optionCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckMark: {
    color: '#ffffff',
    fontWeight: 700,
  },
  customRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
  },
  addButton: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  panel: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  skip: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  challengeDays: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  challengeDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
  },
});
