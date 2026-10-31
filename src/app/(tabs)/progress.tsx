import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { ConsistencyHeatmap, WeeklyBars } from '@/components/progress-charts';
import { ProgressBar } from '@/components/progress-bar';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHabits } from '@/hooks/use-habits';
import { useTheme } from '@/hooks/use-theme';
import { ChallengeBadges, ChallengeLengths } from '@/lib/challenges';
import { parseDateKey } from '@/lib/dates';
import {
  bestStreak,
  completionRate,
  countOn,
  currentStreak,
  isDoneOn,
  targetOn,
  totalLogs,
  type Habit,
} from '@/lib/habits';

const WindowDays = 30;
const LogPageSize = 14;

function formatPercent(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

function Badges() {
  const { badges } = useHabits();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Badges</ThemedText>
      <View style={styles.badges}>
        {ChallengeLengths.map((length) => {
          const earned = badges.filter((badge) => badge.length === length).length;
          const badge = ChallengeBadges[length];
          return (
            <View key={length} style={[styles.badge, !earned && styles.locked]}>
              <Text style={styles.badgeEmoji}>{earned ? badge.emoji : '🔒'}</Text>
              <ThemedText type="smallBold">{badge.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {earned > 1 ? `${length} days ×${earned}` : `${length} days`}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </ThemedView>
  );
}

function HabitSummary({ habit, today }: { habit: Habit; today: Date }) {
  const rate = completionRate(habit, WindowDays, today);
  return (
    <View style={styles.summary}>
      <View style={styles.summaryHeader}>
        <Text style={styles.emoji}>{habit.emoji}</Text>
        <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
          {habit.name}
        </ThemedText>
        <ThemedText type="smallBold">{formatPercent(rate)}</ThemedText>
      </View>
      <ProgressBar progress={rate} color={habit.color} height={6} />
      <ThemedText type="small" themeColor="textSecondary">
        Streak {currentStreak(habit, today)} · Best {bestStreak(habit)} · {totalLogs(habit)} logs
      </ThemedText>
    </View>
  );
}

/** Every logged day, newest first, optionally narrowed to one habit. */
function HistoryLog({ habits }: { habits: Habit[] }) {
  const theme = useTheme();
  const [filter, setFilter] = useState<string | null>(null);
  const [visibleDays, setVisibleDays] = useState(LogPageSize);

  // A filtered habit may have been deleted since; fall back to everything.
  const filtered = habits.filter((habit) => habit.id === filter);
  const shown = filtered.length ? filtered : habits;
  const activeFilter = filtered.length ? filter : null;
  const days = [...new Set(shown.flatMap((habit) => Object.keys(habit.log)))].sort().reverse();

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">History</ThemedText>
      <ChoiceChips
        color="#3c87f7"
        value={activeFilter}
        onChange={(id) => {
          setFilter(id);
          setVisibleDays(LogPageSize);
        }}
        options={[
          { value: null as string | null, label: 'All' },
          ...habits.map((habit) => ({ value: habit.id, label: `${habit.emoji} ${habit.name}` })),
        ]}
      />
      {days.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing logged yet. Your history will appear here.
        </ThemedText>
      )}
      {days.slice(0, visibleDays).map((key) => (
        <View key={key} style={styles.logDay}>
          <ThemedText type="small" themeColor="textSecondary">
            {parseDateKey(key).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </ThemedText>
          {shown
            .filter((habit) => countOn(habit, key) > 0)
            .map((habit) => (
              <View key={habit.id} style={[styles.logEntry, { borderColor: theme.backgroundSelected }]}>
                <Text style={styles.logEmoji}>{habit.emoji}</Text>
                <ThemedText type="small" style={styles.flex} numberOfLines={1}>
                  {habit.name}
                </ThemedText>
                <ThemedText
                  type="smallBold"
                  themeColor={isDoneOn(habit, key) ? 'text' : 'textSecondary'}>
                  {habit.kind === 'count'
                    ? `${countOn(habit, key)}/${targetOn(habit, key)}${isDoneOn(habit, key) ? ' ✓' : ''}`
                    : '✓'}
                </ThemedText>
              </View>
            ))}
        </View>
      ))}
      {days.length > visibleDays && (
        <Pressable onPress={() => setVisibleDays(visibleDays + LogPageSize)} style={styles.more}>
          <ThemedText type="smallBold" style={styles.moreLabel}>
            Show more
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

export default function ProgressScreen() {
  const { habits, today } = useHabits();

  const logs = habits.reduce((sum, habit) => sum + totalLogs(habit), 0);
  const longestStreak = Math.max(0, ...habits.map(bestStreak));
  const averageRate = habits.length
    ? habits.reduce((sum, habit) => sum + completionRate(habit, WindowDays, today), 0) / habits.length
    : 0;

  return (
    <ScreenScrollView>
      <ThemedView style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">
          Last {WindowDays} days
        </ThemedText>
        <ThemedText type="subtitle">Progress</ThemedText>
      </ThemedView>

      <View style={styles.tiles}>
        <StatTile value={formatPercent(averageRate)} label="Completion" />
        <StatTile value={String(longestStreak)} label="Best streak" />
        <StatTile value={String(logs)} label="Total logs" />
      </View>

      <ConsistencyHeatmap habits={habits} today={today} />
      <WeeklyBars habits={habits} today={today} />
      <Badges />

      {habits.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">By habit</ThemedText>
          {habits.map((habit) => (
            <HabitSummary key={habit.id} habit={habit} today={today} />
          ))}
        </ThemedView>
      )}

      <HistoryLog habits={habits} />
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.three,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  badges: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  badge: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  locked: {
    opacity: 0.45,
  },
  badgeEmoji: {
    fontSize: 36,
  },
  summary: {
    gap: Spacing.two,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  emoji: {
    fontSize: 20,
  },
  logDay: {
    gap: Spacing.one,
  },
  logEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logEmoji: {
    fontSize: 16,
  },
  more: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  moreLabel: {
    color: '#3c87f7',
  },
});
