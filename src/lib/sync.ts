// Maps AppState to and from the Supabase tables (supabase/migrations), and works out what to send
// and how to apply what comes back. Pure, so it's unit tested; the network side is sync-remote.ts
// and the scheduling is sync-engine.ts.
import { DefaultSettings, type AppState } from '@/lib/app-state';
import type { ChallengeLength } from '@/lib/challenges';
import type { Habit, HabitKind } from '@/lib/habits';

export type ProfileRow = {
  onboarded: boolean;
  sound: boolean;
  reminder_morning: string | null;
  reminder_evening: string | null;
  challenge_length: ChallengeLength | null;
  challenge_started_on: string | null;
  celebrated_perfect_day: string | null;
};

export type HabitRow = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: HabitKind;
  target: number;
  target_history: { until: string; target: number }[];
  intention_time: string | null;
  created_on: string;
  position: number;
  /** Set when the habit was deleted, so the delete reaches other devices. */
  deleted_at: string | null;
};

/** A day's logs for a habit. count 0 means they were undone. */
export type LogRow = { habit_id: string; day: string; count: number };

export type BadgeRow = { length: ChallengeLength; earned_on: string };

export type Table = 'profiles' | 'habits' | 'habit_logs' | 'badges';
export type Row = ProfileRow | HabitRow | LogRow | BadgeRow;

/** Rows keyed by `rowKey`, whose prefix is the table. */
export type Rows = Record<string, Row>;

/** A row to write. `remove` hard-deletes it (only badges; habits and logs are soft-deleted). */
export type Change = { table: Table; row: Row; remove?: true };

/** Write order: a log needs its habit to exist first. */
export const Tables: Table[] = ['profiles', 'habits', 'habit_logs', 'badges'];

export function rowKey(table: Table, row: Row): string {
  switch (table) {
    case 'profiles':
      return 'profiles';
    case 'habits':
      return `habits/${(row as HabitRow).id}`;
    case 'habit_logs':
      return `habit_logs/${(row as LogRow).habit_id}/${(row as LogRow).day}`;
    case 'badges':
      return `badges/${(row as BadgeRow).length}/${(row as BadgeRow).earned_on}`;
  }
}

export function tableOf(key: string): Table {
  return key.slice(0, key.indexOf('/') === -1 ? key.length : key.indexOf('/')) as Table;
}

const day = (value: unknown) => (value == null ? null : String(value).slice(0, 10));

/**
 * A row from the server in the same shape (and key order) `toRows` builds, so rows compare equal
 * with JSON.stringify. Drops server-only columns (user_id, updated_at).
 */
export function normalize(table: Table, raw: Record<string, any>): Row {
  switch (table) {
    case 'profiles':
      return {
        onboarded: Boolean(raw.onboarded),
        sound: Boolean(raw.sound),
        reminder_morning: raw.reminder_morning ?? null,
        reminder_evening: raw.reminder_evening ?? null,
        challenge_length: raw.challenge_length == null ? null : (Number(raw.challenge_length) as ChallengeLength),
        challenge_started_on: day(raw.challenge_started_on),
        celebrated_perfect_day: day(raw.celebrated_perfect_day),
      };
    case 'habits':
      return {
        id: String(raw.id),
        name: String(raw.name),
        emoji: String(raw.emoji),
        color: String(raw.color),
        kind: raw.kind === 'count' ? 'count' : 'check',
        target: Number(raw.target),
        target_history: Array.isArray(raw.target_history)
          ? raw.target_history.map((item: any) => ({ until: String(item.until), target: Number(item.target) }))
          : [],
        intention_time: raw.intention_time ?? null,
        created_on: day(raw.created_on)!,
        position: Number(raw.position ?? 0),
        deleted_at: raw.deleted_at ?? null,
      };
    case 'habit_logs':
      return { habit_id: String(raw.habit_id), day: day(raw.day)!, count: Number(raw.count) };
    case 'badges':
      return { length: Number(raw.length) as ChallengeLength, earned_on: day(raw.earned_on)! };
  }
}

export function toRows(state: AppState): Rows {
  const rows: Rows = {};
  const add = (table: Table, row: Row) => {
    rows[rowKey(table, row)] = row;
  };
  const { settings, challenge } = state;
  add('profiles', {
    onboarded: state.onboarded,
    sound: settings.sound,
    reminder_morning: settings.reminders.morning,
    reminder_evening: settings.reminders.evening,
    challenge_length: challenge?.length ?? null,
    challenge_started_on: challenge?.startedAt ?? null,
    celebrated_perfect_day: state.celebratedPerfectDay,
  } satisfies ProfileRow);
  state.habits.forEach((habit, position) => {
    add('habits', {
      id: habit.id,
      name: habit.name,
      emoji: habit.emoji,
      color: habit.color,
      kind: habit.kind,
      target: habit.target,
      target_history: habit.targetHistory ?? [],
      intention_time: habit.intentionTime,
      created_on: habit.createdAt,
      position,
      deleted_at: null,
    } satisfies HabitRow);
    for (const [logDay, count] of Object.entries(habit.log)) {
      if (count > 0) add('habit_logs', { habit_id: habit.id, day: logDay, count } satisfies LogRow);
    }
  });
  for (const badge of state.badges) {
    add('badges', { length: badge.length, earned_on: badge.earnedAt } satisfies BadgeRow);
  }
  return rows;
}

/** Rebuilds state from rows. Deleted habits, undone logs and logs of missing habits are skipped. */
export function fromRows(rows: Rows): AppState {
  const profile = rows.profiles as ProfileRow | undefined;
  const entries = (table: Table) =>
    Object.entries(rows)
      .filter(([key]) => tableOf(key) === table)
      .map(([, row]) => row);

  const habits: Habit[] = (entries('habits') as HabitRow[])
    .filter((row) => !row.deleted_at)
    .sort((a, b) => a.position - b.position || a.created_on.localeCompare(b.created_on) || a.id.localeCompare(b.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      color: row.color,
      kind: row.kind,
      target: row.target,
      ...(row.target_history.length ? { targetHistory: row.target_history } : {}),
      intentionTime: row.intention_time,
      createdAt: row.created_on,
      log: {},
    }));
  const byId = new Map(habits.map((habit) => [habit.id, habit]));
  for (const row of entries('habit_logs') as LogRow[]) {
    const habit = byId.get(row.habit_id);
    if (habit && row.count > 0) habit.log[row.day] = row.count;
  }

  const badges = (entries('badges') as BadgeRow[])
    .sort((a, b) => a.earned_on.localeCompare(b.earned_on) || a.length - b.length)
    .map((row) => ({ length: row.length, earnedAt: row.earned_on }));

  return {
    onboarded: profile?.onboarded ?? false,
    habits,
    challenge:
      profile?.challenge_length && profile.challenge_started_on
        ? { length: profile.challenge_length, startedAt: profile.challenge_started_on }
        : null,
    badges,
    settings: profile
      ? { sound: profile.sound, reminders: { morning: profile.reminder_morning, evening: profile.reminder_evening } }
      : DefaultSettings,
    celebratedPerfectDay: profile?.celebrated_perfect_day ?? null,
  };
}

export function sameRow(a: Row | undefined, b: Row | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The writes that turn `prev` into `next`, keyed like rows. Removed habits are soft-deleted at
 * `now` (their logs go with them), removed logs become count 0, removed badges are deleted.
 */
export function diffRows(prev: Rows, next: Rows, now: string): Record<string, Change> {
  const changes: Record<string, Change> = {};
  for (const [key, row] of Object.entries(next)) {
    if (!sameRow(prev[key], row)) changes[key] = { table: tableOf(key), row };
  }
  for (const [key, row] of Object.entries(prev)) {
    if (key in next) continue;
    const table = tableOf(key);
    if (table === 'habits') {
      changes[key] = { table, row: { ...(row as HabitRow), deleted_at: now } };
    } else if (table === 'habit_logs') {
      const habitKey = `habits/${(row as LogRow).habit_id}`;
      if (habitKey in next) changes[key] = { table, row: { ...(row as LogRow), count: 0 } };
    } else if (table === 'badges') {
      changes[key] = { table, row, remove: true };
    }
  }
  return changes;
}

/** What a pull returns: rows changed since the cursor, and every badge (they're hard-deleted). */
export type PullResult = { rows: Rows; badges: Rows; cursor: string | null };

/**
 * Applies pulled rows to local state. Rows with unsent local changes (`pending` keys) keep the
 * local version, which will overwrite the server's when pushed.
 */
export function mergeRows(local: AppState, pulled: PullResult, pending: Set<string>): AppState {
  const rows = toRows(local);
  for (const [key, row] of Object.entries(pulled.rows)) {
    if (pending.has(key)) continue;
    const table = tableOf(key);
    if ((table === 'habits' && (row as HabitRow).deleted_at) || (table === 'habit_logs' && (row as LogRow).count === 0)) {
      delete rows[key];
    } else {
      rows[key] = row;
    }
  }
  for (const key of Object.keys(rows)) {
    if (tableOf(key) === 'badges' && !pending.has(key) && !(key in pulled.badges)) delete rows[key];
  }
  for (const [key, row] of Object.entries(pulled.badges)) {
    if (!pending.has(key)) rows[key] = row;
  }
  return fromRows(rows);
}

/** An account with nothing worth keeping: never onboarded, no habits, no badges. */
export function isAccountEmpty(pulled: PullResult): boolean {
  const profile = pulled.rows.profiles as ProfileRow | undefined;
  const hasHabits = Object.entries(pulled.rows).some(
    ([key, row]) => tableOf(key) === 'habits' && !(row as HabitRow).deleted_at
  );
  return !profile?.onboarded && !hasHabits && Object.keys(pulled.badges).length === 0;
}

/** True when two states would write the same rows. */
export function sameState(a: AppState, b: AppState): boolean {
  return JSON.stringify(toRows(a)) === JSON.stringify(toRows(b));
}
