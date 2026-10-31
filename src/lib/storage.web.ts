// expo-sqlite needs extra wasm/header setup on web, so use localStorage there instead.
export function loadItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export function saveItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}
