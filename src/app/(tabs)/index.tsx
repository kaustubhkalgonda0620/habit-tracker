import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ChallengeCard } from '@/components/challenge-card';
import { HabitRow } from '@/components/habit-row';
import { ProgressBar } from '@/components/progress-bar';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHabits } from '@/hooks/use-habits';
import { isDoneOn } from '@/lib/habits';

const DoneColor = '#30A46C';

function progressMessage(done: number, total: number) {
  if (total === 0) return 'Add your first habit below';
  if (done === total) return 'Perfect day 🎉';
  if (done === 0) return 'Tap a habit to log it';
  if (total - done === 1) return 'One to go!';
  return 'Keep it going!';
}

export default function TodayScreen() {
  const { habits, today, todayKey, logHabit, unlogHabit } = useHabits();
  const doneCount = habits.filter((habit) => isDoneOn(habit, todayKey)).length;

  return (
    <ScreenScrollView>
      <ThemedView style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">
          {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </ThemedText>
        <ThemedText type="subtitle">Today</ThemedText>
      </ThemedView>

      <ChallengeCard />

      <ThemedView type="backgroundElement" style={styles.progressCard}>
        <ThemedView type="backgroundElement" style={styles.progressText}>
          <ThemedText type="smallBold">
            {doneCount} of {habits.length} done
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {progressMessage(doneCount, habits.length)}
          </ThemedText>
        </ThemedView>
        <ProgressBar progress={habits.length ? doneCount / habits.length : 0} color={DoneColor} />
      </ThemedView>

      {habits.map((habit) => (
        <HabitRow
          key={habit.id}
          habit={habit}
          today={today}
          onLog={() => logHabit(habit.id)}
          onUndo={() => unlogHabit(habit.id)}
          onEdit={() => router.push({ pathname: '/habit-editor', params: { id: habit.id } })}
        />
      ))}

      <Pressable
        onPress={() => router.push('/habit-editor')}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundElement" style={styles.newButton}>
          <ThemedText type="smallBold">+ New habit</ThemedText>
        </ThemedView>
      </Pressable>

      {habits.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Long press a habit to edit or delete it
        </ThemedText>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.three,
  },
  progressCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  progressText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
  },
  pressed: {
    opacity: 0.5,
  },
  hint: {
    textAlign: 'center',
  },
});
