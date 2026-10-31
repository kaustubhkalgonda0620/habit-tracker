import { challengeProgress, type Challenge } from '@/lib/challenges';
import { addDays, toDateKey } from '@/lib/dates';
import { countOn, formatTime, habitsActiveOn, isDoneOn, type Habit } from '@/lib/habits';

export type ReminderSettings = {
  /** `HH:MM` for the morning check-in, or null when off. */
  morning: string | null;
  /** `HH:MM` for the evening nudge about unfinished habits, or null when off. */
  evening: string | null;
};

export type PlannedReminder = { date: Date; title: string; body: string };

/** How many days ahead to schedule. Kept small to stay under iOS's 64 pending-notification cap. */
const DaysAhead = 5;
const MaxScheduled = 60;

function at(day: Date, time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/** The reminders to schedule for the next few days, soonest first. Pure, so it can be tested. */
export function planReminders(
  habits: Habit[],
  challenge: Challenge | null,
  settings: ReminderSettings,
  now: Date
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  // Only today's challenge state is known; later days assume today goes to plan.
  const progress = challenge ? challengeProgress(challenge, habits, toDateKey(now)) : null;

  for (let offset = 0; offset < DaysAhead; offset++) {
    const day = addDays(now, offset);
    const key = toDateKey(day);
    const isToday = offset === 0;
    const active = habitsActiveOn(habits, key);
    if (active.length === 0) continue;
    // Only today's progress is known; future days start from zero.
    const remaining = isToday ? active.filter((habit) => !isDoneOn(habit, key)) : active;

    const challengeDay = progress?.status === 'active' ? progress.dayNumber + offset : null;
    const inChallenge = challenge !== null && challengeDay !== null && challengeDay <= challenge.length;
    const challengeLine = inChallenge ? `Day ${challengeDay} of your ${challenge.length}-day challenge. ` : '';

    if (settings.morning && remaining.length > 0) {
      planned.push({
        date: at(day, settings.morning),
        title: inChallenge ? `Day ${challengeDay}: let's keep it going` : 'Ready to start your day?',
        body: `${challengeLine}${remaining.length} habit${remaining.length === 1 ? '' : 's'} on deck today.`,
      });
    }

    for (const habit of remaining) {
      if (!habit.intentionTime) continue;
      planned.push({
        date: at(day, habit.intentionTime),
        title: `${habit.emoji} ${habit.name}`,
        body: `You said you'd do this at ${formatTime(habit.intentionTime)}. Ready?`,
      });
    }

    if (settings.evening && remaining.length > 0) {
      const names = remaining.map((habit) => {
        const left = habit.target - (isToday ? countOn(habit, key) : 0);
        return habit.kind === 'count' ? `${habit.name} (${left} left)` : habit.name;
      });
      planned.push({
        date: at(day, settings.evening),
        title: inChallenge ? "Don't break your challenge 🔥" : "Don't forget 👋",
        body: `Still to do: ${names.join(', ')}.`,
      });
    }
  }

  return planned
    .filter((item) => item.date > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MaxScheduled);
}
