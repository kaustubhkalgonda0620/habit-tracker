import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while web is server rendering or hydrating, true afterwards (and always on native).
 * Gate anything that reads device storage behind it, or the client won't match the server HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
