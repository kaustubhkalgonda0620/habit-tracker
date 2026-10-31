import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, toDateKey } from '@/lib/dates';
import { dayCompletion, habitsActiveOn, isDoneOn, type Habit } from '@/lib/habits';

/** One-hue sequential ramp (low → high), stepped separately for each mode. */
const Ramp = {
  light: ['#C4E8D1', '#86CFA2', '#47AF73', '#1F7A4B'],
  dark: ['#1C3D2B', '#22603F', '#2F8F5A', '#5BD08F'],
} as const;

const HeatmapWeeks = 12;
const BarWeeks = 8;

function useRamp() {
  return Ramp[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

function rampColor(ramp: readonly string[], share: number) {
  return ramp[Math.min(ramp.length - 1, Math.ceil(share * ramp.length) - 1)];
}

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function Card({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {caption}
        </ThemedText>
      </View>
      {children}
    </ThemedView>
  );
}

/** Calendar heatmap: one column per week, shaded by the share of habits finished each day. */
export function ConsistencyHeatmap({ habits, today }: { habits: Habit[]; today: Date }) {
  const theme = useTheme();
  const ramp = useRamp();
  const todayKey = toDateKey(today);
  const start = addDays(today, -(7 * (HeatmapWeeks - 1) + today.getDay()));
  const [selected, setSelected] = useState<string | null>(null);

  const weeks = Array.from({ length: HeatmapWeeks }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => addDays(start, week * 7 + weekday))
  );

  let caption = 'Tap a day for details';
  if (selected) {
    const date = weeks.flat().find((day) => toDateKey(day) === selected)!;
    const active = habitsActiveOn(habits, selected);
    const done = active.filter((habit) => isDoneOn(habit, selected)).length;
    caption = active.length
      ? `${formatDay(date)}: ${done} of ${active.length} habits done`
      : `${formatDay(date)}: no habits yet`;
  }

  return (
    <Card title="Consistency" caption={caption}>
      <View style={styles.heatmap}>
        {weeks.map((week) => (
          <View key={toDateKey(week[0])} style={styles.heatColumn}>
            {week.map((day) => {
              const key = toDateKey(day);
              if (key > todayKey) return <View key={key} style={styles.heatCell} />;
              const share = dayCompletion(habits, key);
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelected(key === selected ? null : key)}
                  accessibilityLabel={formatDay(day)}
                  style={[
                    styles.heatCell,
                    {
                      backgroundColor: share ? rampColor(ramp, share) : theme.backgroundSelected,
                      borderColor: key === selected ? theme.text : 'transparent',
                    },
                    // Days before any habit existed are "no data", not "missed".
                    share === null && styles.noData,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <ThemedText type="small" themeColor="textSecondary">
          Less
        </ThemedText>
        {[theme.backgroundSelected, ...ramp].map((color) => (
          <View key={color} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          More
        </ThemedText>
      </View>
    </Card>
  );
}

/** Average daily completion for each of the last few weeks. */
export function WeeklyBars({ habits, today }: { habits: Habit[]; today: Date }) {
  const theme = useTheme();
  const ramp = useRamp();
  const todayKey = toDateKey(today);
  const currentWeekStart = addDays(today, -today.getDay());
  const [selected, setSelected] = useState(BarWeeks - 1);

  const weeks = Array.from({ length: BarWeeks }, (_, index) => {
    const weekStart = addDays(currentWeekStart, (index - (BarWeeks - 1)) * 7);
    const shares = Array.from({ length: 7 }, (_, day) => toDateKey(addDays(weekStart, day)))
      .filter((key) => key <= todayKey)
      .map((key) => dayCompletion(habits, key))
      .filter((share): share is number => share !== null);
    const average = shares.length ? shares.reduce((sum, share) => sum + share, 0) / shares.length : null;
    return { weekStart, average };
  });

  const focus = weeks[selected];
  const label = focus.weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const caption =
    focus.average === null
      ? `Week of ${label}: no habits yet`
      : `Week of ${label}: ${Math.round(focus.average * 100)}% of habits done${selected === BarWeeks - 1 ? ' so far' : ''}`;

  return (
    <Card title="Weekly completion" caption={caption}>
      <View style={styles.bars}>
        {[1, 0.5].map((line) => (
          <View
            key={line}
            pointerEvents="none"
            style={[styles.gridLine, { bottom: `${line * 100}%`, borderColor: theme.backgroundSelected }]}
          />
        ))}
        {weeks.map((week, index) => (
          <Pressable
            key={toDateKey(week.weekStart)}
            onPress={() => setSelected(index)}
            accessibilityLabel={`Week of ${week.weekStart.toDateString()}`}
            style={styles.barSlot}>
            {/* Weeks before any habit existed have no bar; a real 0% gets a sliver. */}
            {week.average !== null && (
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(week.average * 100, 2)}%`,
                    backgroundColor: index === selected ? ramp[3] : ramp[1],
                  },
                ]}
              />
            )}
          </Pressable>
        ))}
      </View>
      <View style={styles.axis}>
        {weeks.map((week, index) => (
          <ThemedText
            key={toDateKey(week.weekStart)}
            themeColor="textSecondary"
            style={[styles.axisLabel, index === selected && { color: theme.text }]}>
            {index % 2 === (BarWeeks - 1) % 2
              ? week.weekStart.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
              : ''}
          </ThemedText>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  heatmap: {
    flexDirection: 'row',
    gap: 3,
    // Keeps cells small on wide (desktop web) layouts.
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  noData: {
    opacity: 0.35,
  },
  heatColumn: {
    flex: 1,
    gap: 3,
  },
  heatCell: {
    aspectRatio: 1,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  bars: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  barSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.one,
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axis: {
    flexDirection: 'row',
    gap: 2,
    marginTop: -Spacing.two,
  },
  axisLabel: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
