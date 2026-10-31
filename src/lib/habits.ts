import { addDays, lastNDays, parseDateKey, toDateKey } from '@/lib/dates';

/** `check` is done once per day; `count` needs `target` logs in a day (e.g. 4 glasses of water). */
export type HabitKind = 'check' | 'count';

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: HabitKind;
  /** Logs needed per day to count as done. Always 1 for `check` habits. */
  target: number;
  /**
   * Earlier targets, oldest first: `target` applied to days before `until`. Lets an edit change
   * the goal from today on without rewriting history.
   */
  targetHistory?: { until: string; target: number }[];
  /** Optional `HH:MM` the user intends to do it; drives the per-habit reminder. */
  intentionTime: string | null;
  /** Date key of the day the habit was created. */
  createdAt: string;
  /** Logs per day, keyed by date key. Days with no logs are absent. */
  log: Record<string, number>;
};

export type NewHabit = Pick<Habit, 'name' | 'emoji' | 'color' | 'kind' | 'target' | 'intentionTime'>;

export const HabitColors = ['#3c87f7', '#30A46C', '#F76B15', '#E5484D', '#8E4EC6', '#12A594'];
export const HabitEmojis = ['💧', '📚', '🏃', '🧘', '🥗', '😴', '✍️', '🎸', '🌱', '💊'];

/** Starter habits offered during onboarding. */
export const SuggestedHabits: NewHabit[] = [
  { name: 'Drink water', emoji: '💧', color: HabitColors[0], kind: 'count', target: 8, intentionTime: null },
  { name: 'Read for 20 minutes', emoji: '📚', color: HabitColors[4], kind: 'check', target: 1, intentionTime: '21:00' },
  { name: 'Move your body', emoji: '🏃', color: HabitColors[2], kind: 'check', target: 1, intentionTime: '07:30' },
  { name: 'Meditate', emoji: '🧘', color: HabitColors[1], kind: 'check', target: 1, intentionTime: '08:00' },
  { name: 'Eat a vegetable', emoji: '🥗', color: HabitColors[5], kind: 'count', target: 3, intentionTime: null },
  { name: 'Lights out by 11', emoji: '😴', color: HabitColors[3], kind: 'check', target: 1, intentionTime: '22:30' },
];

export function countOn(habit: Habit, dateKey: string): number {
  return habit.log[dateKey] ?? 0;
}

/** The target that applied on `dateKey`. */
export function targetOn(habit: Habit, dateKey: string): number {
  return habit.targetHistory?.find((entry) => dateKey < entry.until)?.target ?? habit.target;
}

export function isDoneOn(habit: Habit, dateKey: string): boolean {
  return countOn(habit, dateKey) >= targetOn(habit, dateKey);
}

/**
 * Applies an edit from the habit editor. A new target takes effect today; earlier days keep
 * the target they were logged against, and today's count is capped at the new target.
 */
export function applyHabitEdit(habit: Habit, changes: NewHabit, todayKey: string): Habit {
  const edited = { ...habit, ...changes };
  if (changes.target === habit.target) return edited;

  const history = habit.targetHistory ?? [];
  const alreadyChangedToday = history.some((entry) => entry.until === todayKey);
  const today = countOn(habit, todayKey);
  return {
    ...edited,
    targetHistory: alreadyChangedToday ? history : [...history, { until: todayKey, target: habit.target }],
    log: today > changes.target ? { ...habit.log, [todayKey]: changes.target } : habit.log,
  };
}

/** Date keys of every fully completed day, oldest first. */
export function completedDays(habit: Habit): string[] {
  return Object.keys(habit.log)
    .filter((key) => isDoneOn(habit, key))
    .sort();
}

/** Every individual log across all days. */
export function totalLogs(habit: Habit): number {
  return Object.values(habit.log).reduce((sum, count) => sum + count, 0);
}

/** Consecutive days completed, counting back from today (or yesterday if today isn't done yet). */
export function currentStreak(habit: Habit, today = new Date()): number {
  let day = isDoneOn(habit, toDateKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (isDoneOn(habit, toDateKey(day))) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function bestStreak(habit: Habit): number {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of completedDays(habit)) {
    run = previous && toDateKey(addDays(parseDateKey(previous), 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return best;
}

/** Share of the last `days` days (since the habit was created) that were completed. */
export function completionRate(habit: Habit, days: number, today = new Date()): number {
  const eligible = lastNDays(days, today)
    .map(toDateKey)
    .filter((key) => key >= habit.createdAt);
  if (eligible.length === 0) return 0;
  return eligible.filter((key) => isDoneOn(habit, key)).length / eligible.length;
}

/** Habits that existed on `dateKey`. */
export function habitsActiveOn(habits: Habit[], dateKey: string): Habit[] {
  return habits.filter((habit) => habit.createdAt <= dateKey);
}

/** Share of the day's habits that were completed, or null if there were none. */
export function dayCompletion(habits: Habit[], dateKey: string): number | null {
  const active = habitsActiveOn(habits, dateKey);
  if (active.length === 0) return null;
  return active.filter((habit) => isDoneOn(habit, dateKey)).length / active.length;
}

export function isPerfectDay(habits: Habit[], dateKey: string): boolean {
  return dayCompletion(habits, dateKey) === 1;
}

export function createHabitId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatTarget(habit: Pick<Habit, 'kind' | 'target'>): string {
  return habit.kind === 'count' ? `${habit.target}× a day` : 'Once a day';
}

/** `HH:MM` → locale time like "7:30 AM". */
export function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Deterministic 0–1 value so sample data looks the same on every reset. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/** A month of believable history so the demo looks lived-in. Today is left unlogged. */
export function createSampleHabits(today = new Date()): Habit[] {
  const samples = [
    { ...SuggestedHabits[0], rate: 0.8, streak: 6 },
    { ...SuggestedHabits[1], rate: 0.6, streak: 3 },
    { ...SuggestedHabits[2], rate: 0.5, streak: 0 },
    { ...SuggestedHabits[3], rate: 0.7, streak: 2 },
  ];
  const history = lastNDays(30, addDays(today, -1));

  return samples.map(({ rate, streak, ...sample }, index) => {
    const log: Record<string, number> = {};
    history.forEach((day, position) => {
      const daysAgo = history.length - position;
      const roll = pseudoRandom(index * 31 + position);
      const done = daysAgo <= streak || (daysAgo !== streak + 1 && roll < rate);
      // Count habits sometimes get partial progress on missed days.
      const count = done ? sample.target : Math.floor(roll * sample.target);
      if (count > 0) log[toDateKey(day)] = count;
    });
    return { ...sample, id: `sample-${index}`, createdAt: toDateKey(history[0]), log };
  });
}

/** Converts a v1 habit (completions array, check-only) to the current shape. */
export function migrateV1Habit(old: {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: string;
  completions: string[];
}): Habit {
  return {
    id: old.id,
    name: old.name,
    emoji: old.emoji,
    color: old.color,
    createdAt: old.createdAt,
    kind: 'check',
    target: 1,
    intentionTime: null,
    log: Object.fromEntries(old.completions.map((key) => [key, 1])),
  };
}
