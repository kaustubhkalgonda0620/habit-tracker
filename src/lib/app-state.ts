import { challengeProgress, type Badge, type Challenge, type ChallengeLength } from '@/lib/challenges';
import type { FeedbackLevel } from '@/lib/feedback';
import {
  applyHabitEdit,
  countOn,
  createHabitId,
  isDoneOn,
  isPerfectDay,
  migrateV1Habit,
  type Habit,
  type NewHabit,
} from '@/lib/habits';
import type { ReminderSettings } from '@/lib/reminder-plan';

export type Settings = {
  sound: boolean;
  reminders: ReminderSettings;
};

export type AppState = {
  onboarded: boolean;
  habits: Habit[];
  /** The challenge in progress, or null between challenges. */
  challenge: Challenge | null;
  badges: Badge[];
  settings: Settings;
  /** Date key of the last perfect day already celebrated, so undo + redo doesn't repeat it. */
  celebratedPerfectDay: string | null;
};

/** What a change earned, so the app can show the right celebration. */
export type Celebration = { kind: 'perfect' } | { kind: 'challenge'; length: ChallengeLength };

export type Outcome = {
  state: AppState;
  celebration: Celebration | null;
  /** Feedback to play, or null when the action did nothing. */
  feedback: FeedbackLevel | null;
};

export const DefaultSettings: Settings = {
  sound: true,
  reminders: { morning: '08:00', evening: '20:00' },
};

export const FreshState: AppState = {
  onboarded: false,
  habits: [],
  challenge: null,
  badges: [],
  settings: DefaultSettings,
  celebratedPerfectDay: null,
};

/**
 * Rebuilds state from storage: the current `stored` JSON, else v1 `legacy` habits (existing users
 * skip onboarding and keep their history), else a fresh start. Missing fields get defaults and
 * corrupt JSON falls back to a fresh start.
 */
export function restoreState(stored: string | null, legacy: string | null): AppState {
  try {
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...FreshState,
        ...parsed,
        settings: {
          ...DefaultSettings,
          ...parsed.settings,
          reminders: { ...DefaultSettings.reminders, ...parsed.settings?.reminders },
        },
      };
    }
    if (legacy) {
      const habits = JSON.parse(legacy).map(migrateV1Habit);
      if (habits.length > 0) return { ...FreshState, onboarded: true, habits };
    }
  } catch {
    // Fall through to a fresh start if storage is corrupted.
  }
  return FreshState;
}

export function newHabit(habit: NewHabit, todayKey: string): Habit {
  return { ...habit, id: createHabitId(), createdAt: todayKey, log: {} };
}

/**
 * Awards the challenge badge if the challenge is now complete. Runs after every habit change,
 * since edits and deletes (not just logs) can finish the last day.
 */
export function settleChallenge(state: AppState, todayKey: string): Outcome {
  const { challenge } = state;
  if (!challenge || challengeProgress(challenge, state.habits, todayKey).status !== 'complete') {
    return { state, celebration: null, feedback: null };
  }
  return {
    state: {
      ...state,
      challenge: null,
      badges: [...state.badges, { length: challenge.length, earnedAt: todayKey }],
      // The challenge celebration covers today's perfect day too.
      celebratedPerfectDay: todayKey,
    },
    celebration: { kind: 'challenge', length: challenge.length },
    feedback: 'celebrate',
  };
}

function withHabits(state: AppState, update: (habit: Habit) => Habit, id: string): AppState {
  return { ...state, habits: state.habits.map((habit) => (habit.id === id ? update(habit) : habit)) };
}

/** Logs one rep (or checks off) today. */
export function logHabit(state: AppState, id: string, todayKey: string): Outcome {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit || isDoneOn(habit, todayKey)) return { state, celebration: null, feedback: null };

  const updated = { ...habit, log: { ...habit.log, [todayKey]: countOn(habit, todayKey) + 1 } };
  const logged = withHabits(state, () => updated, id);

  const settled = settleChallenge(logged, todayKey);
  if (settled.celebration) return settled;

  if (isPerfectDay(logged.habits, todayKey) && state.celebratedPerfectDay !== todayKey) {
    return {
      state: { ...logged, celebratedPerfectDay: todayKey },
      celebration: { kind: 'perfect' },
      feedback: 'celebrate',
    };
  }
  return {
    state: logged,
    celebration: null,
    feedback: isDoneOn(updated, todayKey) ? 'complete' : 'tap',
  };
}

/** Removes one rep (or unchecks) today. */
export function unlogHabit(state: AppState, id: string, todayKey: string): AppState {
  return withHabits(
    state,
    (habit) => {
      const { [todayKey]: count = 0, ...rest } = habit.log;
      return { ...habit, log: count > 1 ? { ...rest, [todayKey]: count - 1 } : rest };
    },
    id
  );
}

export function addHabit(state: AppState, habit: NewHabit, todayKey: string): AppState {
  return { ...state, habits: [...state.habits, newHabit(habit, todayKey)] };
}

export function updateHabit(state: AppState, id: string, changes: NewHabit, todayKey: string): Outcome {
  return settleChallenge(
    withHabits(state, (habit) => applyHabitEdit(habit, changes, todayKey), id),
    todayKey
  );
}

export function deleteHabit(state: AppState, id: string, todayKey: string): Outcome {
  return settleChallenge(
    { ...state, habits: state.habits.filter((habit) => habit.id !== id) },
    todayKey
  );
}

export function startChallenge(state: AppState, length: ChallengeLength, todayKey: string): Outcome {
  // A day that is already perfect counts, so a 1-day-left challenge could finish immediately.
  return settleChallenge({ ...state, challenge: { length, startedAt: todayKey } }, todayKey);
}

export function completeOnboarding(
  state: AppState,
  habits: NewHabit[],
  reminders: ReminderSettings,
  todayKey: string
): AppState {
  return {
    ...state,
    onboarded: true,
    habits: habits.map((habit) => newHabit(habit, todayKey)),
    challenge: { length: 3, startedAt: todayKey },
    badges: [],
    celebratedPerfectDay: null,
    settings: { ...state.settings, reminders },
  };
}
