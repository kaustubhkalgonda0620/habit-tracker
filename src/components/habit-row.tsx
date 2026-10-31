import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Burst } from '@/components/burst';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { lastNDays, toDateKey, weekdayInitial } from '@/lib/dates';
import { countOn, currentStreak, formatTime, targetOn, type Habit } from '@/lib/habits';

type HabitRowProps = {
  habit: Habit;
  today: Date;
  /** Logs one more rep today. */
  onLog: () => void;
  /** Removes one rep (or unchecks) today. */
  onUndo: () => void;
  onEdit: () => void;
};

function subtitle(habit: Habit, streak: number) {
  const parts = [streak > 0 ? `🔥 ${streak} day streak` : 'Start a streak today'];
  if (habit.intentionTime) parts.push(`⏰ ${formatTime(habit.intentionTime)}`);
  return parts.join('  ·  ');
}

export function HabitRow({ habit, today, onLog, onUndo, onEdit }: HabitRowProps) {
  const theme = useTheme();
  const count = countOn(habit, toDateKey(today));
  const done = count >= habit.target;
  const streak = currentStreak(habit, today);

  // Animate on increases only, so undo and initial render stay calm.
  const previousCount = useRef(count);
  const scale = useSharedValue(1);
  const fill = useSharedValue(Math.min(count / habit.target, 1));

  useEffect(() => {
    fill.set(withSpring(Math.min(count / habit.target, 1), { damping: 14, stiffness: 140 }));
    if (count > previousCount.current) {
      const finished = count >= habit.target;
      scale.set(
        withSequence(
          withTiming(finished ? 1.3 : 1.15, { duration: 110 }),
          withSpring(1, { damping: 6, stiffness: 220 })
        )
      );
    }
    previousCount.current = count;
  }, [count, habit.target, fill, scale]);

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const fillStyle = useAnimatedStyle(() => ({ height: `${fill.get() * 100}%` }));

  const isCount = habit.kind === 'count';

  return (
    <Pressable
      onPress={done && !isCount ? onUndo : onLog}
      onLongPress={onEdit}
      accessibilityRole={isCount ? 'adjustable' : 'checkbox'}
      accessibilityState={isCount ? undefined : { checked: done }}
      accessibilityValue={isCount ? { min: 0, max: habit.target, now: count } : undefined}
      accessibilityLabel={habit.name}
      accessibilityHint={
        isCount ? 'Tap to log one. Long press to edit.' : 'Tap to check off today. Long press to edit.'
      }
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.row}>
        <View style={[styles.emojiBadge, { backgroundColor: `${habit.color}33` }]}>
          <Text style={styles.emoji}>{habit.emoji}</Text>
        </View>

        <View style={styles.details}>
          <ThemedText numberOfLines={1}>{habit.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle(habit, streak)}
          </ThemedText>
          <View style={styles.week}>
            {lastNDays(7, today).map((day) => {
              const key = toDateKey(day);
              const share = Math.min(countOn(habit, key) / targetOn(habit, key), 1);
              return (
                <View key={key} style={styles.dayColumn}>
                  <ThemedText themeColor="textSecondary" style={styles.dayLabel}>
                    {weekdayInitial(day)}
                  </ThemedText>
                  <View style={[styles.dayDot, { backgroundColor: theme.backgroundSelected }]}>
                    {share > 0 && (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          { backgroundColor: habit.color, opacity: share === 1 ? 1 : 0.25 + share * 0.5 },
                        ]}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.actions}>
          {isCount && count > 0 && (
            <Pressable
              onPress={onUndo}
              hitSlop={8}
              accessibilityLabel={`Remove one ${habit.name}`}
              style={({ pressed }) => [
                styles.undo,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                −
              </ThemedText>
            </Pressable>
          )}
          <View>
            <Burst active={done} color={habit.color} />
            <Animated.View style={[styles.check, { borderColor: habit.color }, buttonStyle]}>
              <Animated.View style={[styles.fill, { backgroundColor: habit.color }, fillStyle]} />
              {done ? (
                <Text style={styles.checkMark}>✓</Text>
              ) : isCount ? (
                <ThemedText type="smallBold" style={styles.countLabel}>
                  {count}/{habit.target}
                </ThemedText>
              ) : null}
            </Animated.View>
          </View>
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  emojiBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  details: {
    flex: 1,
    gap: Spacing.half,
  },
  week: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  dayColumn: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  dayLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  dayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  undo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 700,
  },
  countLabel: {
    fontSize: 12,
  },
});
