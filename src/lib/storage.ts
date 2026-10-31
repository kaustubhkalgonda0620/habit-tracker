import Storage from 'expo-sqlite/kv-store';

export function loadItem(key: string): string | null {
  return Storage.getItemSync(key);
}

export function saveItem(key: string, value: string) {
  Storage.setItemSync(key, value);
}
