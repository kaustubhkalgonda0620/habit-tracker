import { addDays, parseDateKey, toDateKey } from '@/lib/dates';
import { isPerfectDay, type Habit } from '@/lib/habits';

/** Challenge tiers, in the order they unlock. */
export const ChallengeLengths = [3, 7, 21] as const;
export type ChallengeLength = (typeof ChallengeLengths)[number];

export const ChallengeBadges: Record<ChallengeLength, { emoji: string; title: string }> = {
  3: { emoji: '🌱', title: 'Spark' },
  7: { emoji: '🔥', title: 'On Fire' },
  21: { emoji: '🏆', title: 'Habit Formed' },
};

/** A run of consecutive perfect days (every habit done) starting on `startedAt`. */
export type Challenge = {
  length: ChallengeLength;
  startedAt: string;
};

export type Badge = {
  length: ChallengeLength;
  earnedAt: string;
};

export type ChallengeStatus = 'active' | 'failed' | 'complete';

export type ChallengeProgress = {
  status: ChallengeStatus;
  /** Perfect days so far. */
  daysDone: number;
  /** 1-based day of the challenge today is (capped at length). */
  dayNumber: number;
  /** Whether today is already perfect. */
  todayDone: boolean;
};

export function challengeProgress(
  challenge: Challenge,
  habits: Habit[],
  todayKey: string
): ChallengeProgress {
  const start = parseDateKey(challenge.startedAt);
  let daysDone = 0;
  let dayNumber = 1;

  for (let day = 0; day < challenge.length; day++) {
    const key = toDateKey(addDays(start, day));
    if (key > todayKey) break;
    dayNumber = day + 1;
    if (isPerfectDay(habits, key)) {
      daysDone++;
    } else if (key < todayKey) {
      return { status: 'failed', daysDone, dayNumber, todayDone: false };
    }
  }

  return {
    status: daysDone >= challenge.length ? 'complete' : 'active',
    daysDone,
    dayNumber,
    todayDone: isPerfectDay(habits, todayKey),
  };
}

/** The next tier after `length`, or the top tier again once everything is unlocked. */
export function nextChallengeLength(length: ChallengeLength | null): ChallengeLength {
  if (length === null) return ChallengeLengths[0];
  const index = ChallengeLengths.indexOf(length);
  return ChallengeLengths[Math.min(index + 1, ChallengeLengths.length - 1)];
}
