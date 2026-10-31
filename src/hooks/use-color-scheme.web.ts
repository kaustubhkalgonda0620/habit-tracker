import { useColorScheme as useRNColorScheme } from 'react-native';

import { useHydrated } from '@/hooks/use-hydrated';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const hasHydrated = useHydrated();
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
