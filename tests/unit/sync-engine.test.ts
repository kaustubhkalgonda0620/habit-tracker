/// <reference types="node" />
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import * as App from '@/lib/app-state';
import { rowKey, Tables, type Change, type PullResult, type Row, type Rows } from '@/lib/sync';
import { SyncEngine, type SyncRemote } from '@/lib/sync-engine';
import { appState, day, habit, TODAY } from './fixtures';

/** An in-memory account store. Rows carry a write counter in place of updated_at. */
class FakeServer implements SyncRemote {
  rows = new Map<string, { user: string; table: string; row: Row; at: number }>();
  clock = 0;
  online = true;
  /** When set, push/pull wait for it before answering. */
  gate: Promise<void> | null = null;

  async push(user: string, changes: Change[]) {
    await this.gate;
    if (!this.online) throw new Error('offline');
    for (const table of Tables) {
      for (const change of changes.filter((item) => item.table === table)) {
        const key = `${user}:${rowKey(table, change.row)}`;
        if (change.remove) this.rows.delete(key);
        else this.rows.set(key, { user, table, row: change.row, at: ++this.clock });
      }
    }
  }

  async pull(user: string, since: string | null): Promise<PullResult> {
    await this.gate;
    if (!this.online) throw new Error('offline');
    const rows: Rows = {};
    const badges: Rows = {};
    let newest = since ? Number(since) : 0;
    for (const entry of this.rows.values()) {
      if (entry.user !== user) continue;
      const key = rowKey(entry.table as never, entry.row);
      if (entry.table === 'badges') badges[key] = entry.row;
      else if (entry.at > (since ? Number(since) : -1)) rows[key] = entry.row;
      newest = Math.max(newest, entry.at);
    }
    return { rows, badges, cursor: newest ? String(newest) : null };
  }

  /** The user's rows, keyed like `toRows`. */
  of(user: string): Rows {
    return Object.fromEntries(
      [...this.rows.entries()].filter(([, e]) => e.user === user).map(([key, e]) => [key.slice(user.length + 1), e.row])
    );
  }
}

const engines: SyncEngine[] = [];
afterEach(() => {
  // Cancels pending push/retry timers so the test process can exit.
  for (const engine of engines.splice(0)) engine.setUser(null);
});

function memoryStore(initial: string | null = null) {
  const store = { value: initial, load: () => store.value, save: (value: string) => (store.value = value) };
  return store;
}

function device(server: FakeServer, initial: App.AppState, store = memoryStore()) {
  const host = { state: initial, getState: () => host.state, setState: (next: App.AppState) => (host.state = next) };
  const engine = new SyncEngine(server, host, store, { pushDelay: 60_000, retryDelay: 60_000, now: () => 'deleted-now' });
  engines.push(engine);
  /** A local change, the way the provider makes one. */
  const commit = (next: App.AppState) => {
    engine.recordChange(host.state, next);
    host.state = next;
  };
  const signIn = async (user = 'u') => {
    engine.setUser(user);
    await engine.sync();
  };
  return { host, engine, commit, signIn, store };
}

const withHabits = () => appState([habit('read', { log: { [day(-1)]: 1 } }), habit('walk')]);

test('@sanity first sign-in to an empty account uploads this device', async () => {
  const server = new FakeServer();
  const phone = device(server, withHabits());
  await phone.signIn();
  assert.deepEqual(Object.keys(server.of('u')).sort(), [`habit_logs/read/${day(-1)}`, 'habits/read', 'habits/walk', 'profiles']);
  assert.deepEqual(phone.host.state, withHabits(), 'local data is kept');
  assert.deepEqual(phone.engine.getSnapshot(), { syncedUser: 'u', status: 'idle', pending: 0 });
});

test('@sanity first sign-in to an account with data replaces this device', async () => {
  const server = new FakeServer();
  await device(server, withHabits()).signIn();
  const tablet = device(server, appState([habit('other')]));
  await tablet.signIn();
  assert.deepEqual(tablet.host.state.habits.map((h) => h.id), ['read', 'walk']);
  assert.deepEqual(tablet.host.state.habits[0].log, { [day(-1)]: 1 });
  assert.equal(server.of('u')['habits/other'], undefined, 'the device data is not uploaded');
});

test('@sanity local changes are pushed and reach another device', async () => {
  const server = new FakeServer();
  const phone = device(server, withHabits());
  const tablet = device(server, App.FreshState);
  await phone.signIn();
  await tablet.signIn();

  phone.commit(App.logHabit(phone.host.state, 'walk', TODAY).state);
  assert.equal(phone.engine.getSnapshot().pending, 1);
  await phone.engine.sync();
  assert.equal(phone.engine.getSnapshot().pending, 0);

  await tablet.engine.sync();
  assert.deepEqual(tablet.host.state.habits[1].log, { [TODAY]: 1 });
});

test('@sanity deletes and undos reach another device', async () => {
  const server = new FakeServer();
  const phone = device(server, withHabits());
  const tablet = device(server, App.FreshState);
  await phone.signIn();
  await tablet.signIn();

  phone.commit(App.deleteHabit(phone.host.state, 'walk', TODAY).state);
  phone.commit({ ...phone.host.state, habits: [{ ...phone.host.state.habits[0], log: {} }] });
  await phone.engine.sync();
  await tablet.engine.sync();
  assert.deepEqual(tablet.host.state.habits.map((h) => [h.id, h.log]), [['read', {}]]);
});

test('@sanity offline changes stay on the device and are sent once back online', async () => {
  const server = new FakeServer();
  const phone = device(server, withHabits());
  await phone.signIn();
  server.online = false;
  phone.commit(App.logHabit(phone.host.state, 'walk', TODAY).state);
  await phone.engine.sync();
  assert.deepEqual(phone.engine.getSnapshot(), { syncedUser: 'u', status: 'offline', pending: 1 });
  assert.equal(await phone.engine.flush(), 1);

  server.online = true;
  await phone.engine.sync();
  assert.deepEqual(phone.engine.getSnapshot(), { syncedUser: 'u', status: 'idle', pending: 0 });
  assert.deepEqual(server.of('u')[`habit_logs/walk/${TODAY}`], { habit_id: 'walk', day: TODAY, count: 1 });
});

test('unsent changes survive an app restart', async () => {
  const server = new FakeServer();
  const store = memoryStore();
  const phone = device(server, withHabits(), store);
  await phone.signIn();
  server.online = false;
  phone.commit(App.logHabit(phone.host.state, 'walk', TODAY).state);

  server.online = true;
  const restarted = device(server, phone.host.state, store);
  assert.equal(restarted.engine.getSnapshot().pending, 1);
  await restarted.signIn();
  assert.ok(server.of('u')[`habit_logs/walk/${TODAY}`]);
});

test('a change made while a push is in flight is not lost', async () => {
  const server = new FakeServer();
  const phone = device(server, withHabits());
  await phone.signIn();

  let release!: () => void;
  server.gate = new Promise((resolve) => (release = resolve));
  phone.commit({ ...phone.host.state, settings: { ...phone.host.state.settings, sound: false } });
  const pushing = phone.engine.sync({ pull: false });
  phone.commit({ ...phone.host.state, settings: { ...phone.host.state.settings, sound: true } });
  release();
  server.gate = null;
  await pushing;
  assert.equal(phone.engine.getSnapshot().pending, 1, 'the second change is still queued');
  await phone.engine.sync();
  assert.equal((server.of('u').profiles as { sound: boolean }).sound, true);
});

test('another account’s data left on the device is not uploaded', async () => {
  const server = new FakeServer();
  // Signed out without clearing (e.g. the session expired), then someone else signs in.
  const store = memoryStore(JSON.stringify({ userId: 'previous', cursor: null, outbox: {} }));
  const phone = device(server, withHabits(), store);
  await phone.signIn('someone-else');
  assert.deepEqual(phone.host.state, App.FreshState);
  assert.equal(server.of('someone-else')['habits/read'], undefined);
});

test('forgetting the account makes the next sign-in load it fresh', async () => {
  const server = new FakeServer();
  const phone = device(server, withHabits());
  await phone.signIn();
  phone.engine.forgetAccount();
  phone.host.setState(App.FreshState);
  assert.deepEqual(phone.engine.getSnapshot(), { syncedUser: null, status: 'idle', pending: 0 });

  await phone.signIn();
  assert.deepEqual(phone.host.state.habits.map((h) => h.id), ['read', 'walk']);
});

test('signing out mid-sync drops the results', async () => {
  const server = new FakeServer();
  await device(server, withHabits()).signIn();
  const tablet = device(server, App.FreshState);
  let release!: () => void;
  server.gate = new Promise((resolve) => (release = resolve));
  tablet.engine.setUser('u');
  const syncing = tablet.engine.sync();
  tablet.engine.forgetAccount();
  release();
  server.gate = null;
  await syncing;
  assert.deepEqual(tablet.host.state, App.FreshState);
  assert.equal(tablet.engine.getSnapshot().syncedUser, null);
});

test('corrupt sync data is treated as a new device', async () => {
  const server = new FakeServer();
  const phone = device(server, withHabits(), memoryStore('{not json'));
  await phone.signIn();
  assert.ok(server.of('u')['habits/read']);
});

test('repeated changes to the same row are sent once', async () => {
  const server = new FakeServer();
  const phone = device(server, appState([habit('water', { kind: 'count', target: 8 }), habit('walk')]));
  await phone.signIn();
  for (let i = 0; i < 3; i++) phone.commit(App.logHabit(phone.host.state, 'water', TODAY).state);
  phone.commit(App.unlogHabit(phone.host.state, 'water', TODAY));
  assert.equal(phone.engine.getSnapshot().pending, 1, "one row for today's water");
  await phone.engine.sync();
  assert.deepEqual(server.of('u')[`habit_logs/water/${TODAY}`], { habit_id: 'water', day: TODAY, count: 2 });
});
