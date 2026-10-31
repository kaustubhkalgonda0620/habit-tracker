import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useToday } from '@/hooks/use-today';
import * as App from '@/lib/app-state';
import type { AppState, Celebration, Outcome, Settings } from '@/lib/app-state';
import type { ChallengeLength } from '@/lib/challenges';
import { toDateKey } from '@/lib/dates';
import { playFeedback, playSelection } from '@/lib/feedback';
import { createSampleHabits, type NewHabit } from '@/lib/habits';
import type { ReminderSettings } from '@/lib/reminder-plan';
import { syncReminders } from '@/lib/reminders';
import { loadItem, saveItem } from '@/lib/storage';

export type { Celebration, Settings };

const StorageKey = 'app:v2';
const LegacyStorageKey = 'habits:v1';

function loadState(): AppState {
  return App.restoreState(loadItem(StorageKey), loadItem(LegacyStorageKey));
}

type HabitsContextValue = AppState & {
  /** The current local day; rolls over at midnight. */
  today: Date;
  todayKey: string;
  /** A celebration waiting to be shown, if any. */
  pendingCelebration: Celebration | null;
  clearCelebration: () => void;
  /** Logs one rep (or checks off) today. */
  logHabit: (id: string) => void;
  /** Removes one rep (or unchecks) today. */
  unlogHabit: (id: string) => void;
  addHabit: (habit: NewHabit) => void;
  updateHabit: (id: string, changes: NewHabit) => void;
  deleteHabit: (id: string) => void;
  startChallenge: (length: ChallengeLength) => void;
  completeOnboarding: (habits: NewHabit[], reminders: ReminderSettings) => void;
  updateSettings: (changes: Partial<Settings>) => void;
  resetToSampleData: () => void;
  resetEverything: () => void;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [pendingCelebration, setPendingCelebration] = useState<Celebration | null>(null);
  // Latest state for event handlers, so two taps before a re-render both count.
  const latest = useRef(state);
  const today = useToday();
  const todayKey = toDateKey(today);

  useEffect(() => {
    saveItem(StorageKey, JSON.stringify(state));
  }, [state]);

  const { habits, challenge, settings } = state;
  useEffect(() => {
    syncReminders(habits, challenge, settings.reminders).catch(() => {});
    // todayKey: reschedule after midnight so the window keeps rolling forward.
  }, [habits, challenge, settings.reminders, todayKey]);

  function commit(next: AppState) {
    latest.current = next;
    setState(next);
  }

  /** Applies a change that may earn a celebration. Uses the real clock, not the cached day. */
  function commitOutcome(change: (current: AppState, key: string) => Outcome) {
    const outcome = change(latest.current, toDateKey(new Date()));
    commit(outcome.state);
    if (outcome.feedback) playFeedback(outcome.feedback, { sound: outcome.state.settings.sound });
    if (outcome.celebration) setPendingCelebration(outcome.celebration);
  }

  function update(change: (current: AppState, key: string) => AppState) {
    commit(change(latest.current, toDateKey(new Date())));
  }

  const value: HabitsContextValue = {
    ...state,
    today,
    todayKey,
    pendingCelebration,
    clearCelebration: () => setPendingCelebration(null),
    logHabit: (id) => commitOutcome((current, key) => App.logHabit(current, id, key)),
    unlogHabit: (id) => {
      playSelection();
      update((current, key) => App.unlogHabit(current, id, key));
    },
    addHabit: (habit) => update((current, key) => App.addHabit(current, habit, key)),
    updateHabit: (id, changes) =>
      commitOutcome((current, key) => App.updateHabit(current, id, changes, key)),
    deleteHabit: (id) => commitOutcome((current, key) => App.deleteHabit(current, id, key)),
    startChallenge: (length) =>
      commitOutcome((current, key) => App.startChallenge(current, length, key)),
    completeOnboarding: (newHabits, reminders) =>
      update((current, key) => App.completeOnboarding(current, newHabits, reminders, key)),
    updateSettings: (changes) =>
      update((current) => ({ ...current, settings: { ...current.settings, ...changes } })),
    resetToSampleData: () =>
      update((current) => ({
        ...current,
        onboarded: true,
        habits: createSampleHabits(),
        challenge: null,
        badges: [],
        celebratedPerfectDay: null,
      })),
    resetEverything: () => {
      setPendingCelebration(null);
      commit(App.FreshState);
    },
  };

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits() {
  const context = useContext(HabitsContext);
  if (!context) throw new Error('useHabits must be used inside <HabitsProvider>');
  return context;
}
