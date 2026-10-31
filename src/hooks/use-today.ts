import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { addDays, toDateKey } from '@/lib/dates';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The current local day, as state. Rolls over at midnight and when the app returns to the
 * foreground, so screens left open overnight (or memoized by React Compiler) don't go stale.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    const refresh = () =>
      setToday((current) => {
        const now = startOfDay(new Date());
        return toDateKey(now) === toDateKey(current) ? current : now;
      });

    const untilMidnight = addDays(today, 1).getTime() - Date.now() + 1000;
    const timer = setTimeout(refresh, Math.max(untilMidnight, 1000));
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
}
