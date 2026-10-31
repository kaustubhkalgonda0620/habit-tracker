import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { playSelection } from '@/lib/feedback';
import { formatTime, HabitColors, HabitEmojis, type NewHabit } from '@/lib/habits';

const IntentionTimes = ['07:00', '08:00', '12:00', '17:00', '19:00', '21:00', '22:30'];
const MaxTarget = 20;

type HabitFieldsProps = {
  value: NewHabit;
  onChange: (value: NewHabit) => void;
  onSubmit?: () => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </ThemedView>
  );
}

/** Every editable property of a habit, used by the habit editor. */
export function HabitFields({ value, onChange, onSubmit }: HabitFieldsProps) {
  const theme = useTheme();
  const set = (changes: Partial<NewHabit>) => onChange({ ...value, ...changes });

  function stepTarget(delta: number) {
    playSelection();
    set({ target: Math.min(MaxTarget, Math.max(2, value.target + delta)) });
  }

  return (
    <>
      <Section title="Name">
        <TextInput
          value={value.name}
          onChangeText={(name) => set({ name })}
          onSubmitEditing={onSubmit}
          placeholder="e.g. Go for a walk"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="done"
          maxLength={40}
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
        />
      </Section>

      <Section title="How often?">
        <ChoiceChips
          color={value.color}
          value={value.kind}
          onChange={(kind) => set({ kind, target: kind === 'check' ? 1 : Math.max(value.target, 3) })}
          options={[
            { value: 'check' as const, label: 'Once a day' },
            { value: 'count' as const, label: 'Several times a day' },
          ]}
        />
        {value.kind === 'count' && (
          <View style={styles.stepper}>
            <Pressable
              onPress={() => stepTarget(-1)}
              accessibilityLabel="Fewer times"
              style={[styles.stepButton, { backgroundColor: theme.background }]}>
              <ThemedText type="subtitle">−</ThemedText>
            </Pressable>
            <View style={styles.stepValue}>
              <ThemedText type="subtitle">{value.target}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                times a day
              </ThemedText>
            </View>
            <Pressable
              onPress={() => stepTarget(1)}
              accessibilityLabel="More times"
              style={[styles.stepButton, { backgroundColor: theme.background }]}>
              <ThemedText type="subtitle">+</ThemedText>
            </Pressable>
          </View>
        )}
      </Section>

      <Section title="When will you do it?">
        <ThemedText type="small" themeColor="textSecondary">
          We&apos;ll remind you at this time if it isn&apos;t done yet.
        </ThemedText>
        <ChoiceChips
          color={value.color}
          value={value.intentionTime}
          onChange={(intentionTime) => set({ intentionTime })}
          options={[
            { value: null, label: 'Anytime' },
            ...IntentionTimes.map((time) => ({ value: time, label: formatTime(time) })),
          ]}
        />
      </Section>

      <Section title="Look">
        <View style={styles.options}>
          {HabitEmojis.map((option) => (
            <Pressable
              key={option}
              onPress={() => set({ emoji: option })}
              accessibilityLabel={`Icon ${option}`}
              accessibilityState={{ selected: option === value.emoji }}
              style={[
                styles.emojiOption,
                { backgroundColor: option === value.emoji ? `${value.color}40` : theme.background },
              ]}>
              <Text style={styles.emoji}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.options}>
          {HabitColors.map((option) => (
            <Pressable
              key={option}
              onPress={() => set({ color: option })}
              accessibilityLabel={`Color ${option}`}
              accessibilityState={{ selected: option === value.color }}
              style={[
                styles.colorOption,
                { backgroundColor: option, borderColor: option === value.color ? theme.text : 'transparent' },
              ]}
            />
          ))}
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Spacing.three,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    alignItems: 'center',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  emojiOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
  },
});
