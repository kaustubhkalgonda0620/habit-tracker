/// <reference types="node" />
// Shared builders for unit tests. Everything is pinned to a fixed "now" so results never depend
// on the day the suite runs.
import * as App from '@/lib/app-state';
import { addDays, toDateKey } from '@/lib/dates';
import type { Habit, NewHabit } from '@/lib/habits';

/** Friday 30 Oct 2026, 3 PM local time. */
export const NOW = new Date(2026, 9, 30, 15, 0);

/** Date key `offset` days from NOW (negative = past). */
export const day = (offset: number) => toDateKey(addDays(NOW, offset));
export const TODAY = day(0);

export function habit(id: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    name: id,
    emoji: '⭐',
    color: '#3c87f7',
    kind: 'check',
    target: 1,
    intentionTime: null,
    createdAt: day(-10),
    log: {},
    ...overrides,
  };
}

export function appState(habits: Habit[], overrides: Partial<App.AppState> = {}): App.AppState {
  return { ...App.FreshState, onboarded: true, habits, ...overrides };
}

/** The editor's view of `habit` with `changes` applied. */
export function edited(habit: Habit, changes: Partial<NewHabit>): NewHabit {
  const { name, emoji, color, kind, target, intentionTime } = habit;
  return { name, emoji, color, kind, target, intentionTime, ...changes };
}
