// Keeps device state and the signed-in account in step. Local changes go into a persisted outbox
// and are pushed shortly after; pulls fetch rows changed since the last one and merge them in.
// No React or Supabase here (they're injected), so the rules are unit tested.
import { FreshState, type AppState } from '@/lib/app-state';
import {
  diffRows,
  fromRows,
  isAccountEmpty,
  mergeRows,
  sameState,
  toRows,
  type Change,
  type PullResult,
} from '@/lib/sync';

export type SyncRemote = {
  /** Writes the changes for `userId`, in `Tables` order. */
  push(userId: string, changes: Change[]): Promise<void>;
  /** Rows changed after `since` (everything when null), plus every badge. */
  pull(userId: string, since: string | null): Promise<PullResult>;
};

export type SyncHost = {
  getState(): AppState;
  /** Shows state that came from the account. Must not call `recordChange`. */
  setState(next: AppState): void;
};

export type SyncStore = { load(): string | null; save(value: string): void };

export type SyncStatus = 'idle' | 'syncing' | 'offline';

export type SyncSnapshot = {
  /** The account this device's data belongs to, once its first sync finished; else null. */
  syncedUser: string | null;
  status: SyncStatus;
  /** Local changes not yet saved to the account. */
  pending: number;
};

type Meta = {
  userId: string | null;
  /** Server time of the newest row seen, for incremental pulls. */
  cursor: string | null;
  outbox: Record<string, Change>;
};

const EmptyMeta: Meta = { userId: null, cursor: null, outbox: {} };

function parseMeta(stored: string | null): Meta {
  try {
    const parsed = stored ? JSON.parse(stored) : null;
    if (parsed && typeof parsed === 'object' && parsed.outbox && typeof parsed.outbox === 'object') {
      return { userId: parsed.userId ?? null, cursor: parsed.cursor ?? null, outbox: parsed.outbox };
    }
  } catch {
    // Corrupt sync data: start over. The next sync treats this device as new to the account.
  }
  return { ...EmptyMeta, outbox: {} };
}

/** The signed-in user changed while a sync was running; its results no longer apply. */
class Superseded extends Error {}

type Options = {
  /** How long to wait after a change before pushing, so a burst of taps is one request. */
  pushDelay?: number;
  /** How long to wait before retrying after a failed sync. */
  retryDelay?: number;
  now?: () => string;
};

export class SyncEngine {
  private meta: Meta;
  private user: string | null = null;
  private snapshot: SyncSnapshot;
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  /** A sync was asked for while one was running; `pull` if any request wanted one. */
  private queued: { pull: boolean } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly pushDelay: number;
  private readonly retryDelay: number;
  private readonly now: () => string;
  private readonly remote: SyncRemote;
  private readonly host: SyncHost;
  private readonly store: SyncStore;

  constructor(remote: SyncRemote, host: SyncHost, store: SyncStore, options: Options = {}) {
    this.remote = remote;
    this.host = host;
    this.store = store;
    this.pushDelay = options.pushDelay ?? 1000;
    this.retryDelay = options.retryDelay ?? 30_000;
    this.now = options.now ?? (() => new Date().toISOString());
    this.meta = parseMeta(store.load());
    this.snapshot = { syncedUser: this.meta.userId, status: 'idle', pending: this.pendingCount() };
  }

  // ---------- For useSyncExternalStore ----------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  // ---------- Inputs ----------

  /** Records a local change from `prev` to `next` and schedules a push. */
  recordChange(prev: AppState, next: AppState) {
    const changes = diffRows(toRows(prev), toRows(next), this.now());
    if (Object.keys(changes).length === 0) return;
    Object.assign(this.meta.outbox, changes);
    this.save();
    this.schedule(this.pushDelay, false);
  }

  /** The signed-in user (null when signed out). Signing in starts a sync. */
  setUser(userId: string | null) {
    if (userId === this.user) return;
    this.user = userId;
    this.cancelTimer();
    if (userId) void this.sync();
  }

  /** Pushes unsent changes, then (by default) pulls. Resolves when done, even if it failed. */
  sync({ pull = true }: { pull?: boolean } = {}): Promise<void> {
    if (!this.user) return Promise.resolve();
    this.cancelTimer();
    this.queued = { pull: pull || (this.queued?.pull ?? false) };
    this.running ??= this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Tries to push unsent changes; resolves with how many are still unsent. */
  async flush(): Promise<number> {
    await this.sync({ pull: false });
    return this.pendingCount();
  }

  /** Explicit sign-out: forget the account and its unsent changes. */
  forgetAccount() {
    this.user = null;
    this.cancelTimer();
    this.queued = null;
    this.meta = { ...EmptyMeta, outbox: {} };
    this.save();
    this.update({ syncedUser: null, status: 'idle' });
  }

  // ---------- Internals ----------

  private async loop() {
    this.update({ status: 'syncing' });
    let status: SyncStatus = 'idle';
    while (this.queued && this.user) {
      const { pull } = this.queued;
      this.queued = null;
      try {
        await this.syncOnce(this.user, pull);
        status = 'idle';
      } catch (error) {
        if (error instanceof Superseded) continue;
        status = 'offline';
        this.queued = null;
        this.schedule(this.retryDelay, true);
        break;
      }
    }
    this.update({ status });
  }

  private async syncOnce(user: string, pull: boolean) {
    const check = () => {
      if (this.user !== user) throw new Superseded();
    };

    if (this.meta.userId !== user) {
      // First sync of this account on this device.
      const pulled = await this.remote.pull(user, null);
      check();
      // Data left by another account (signed out without forgetting) isn't this user's.
      const local = this.meta.userId === null ? this.host.getState() : FreshState;
      if (isAccountEmpty(pulled)) {
        // New account: it starts with what's on this device.
        this.meta = { userId: user, cursor: pulled.cursor, outbox: diffRows({}, toRows(local), this.now()) };
        if (local !== this.host.getState()) this.host.setState(local);
      } else {
        // The account already has data: it wins over this device's.
        this.meta = { userId: user, cursor: pulled.cursor, outbox: {} };
        this.host.setState(fromRows({ ...pulled.rows, ...pulled.badges }));
      }
      this.save();
      this.update({ syncedUser: user });
      pull = false;
    }

    const sending = Object.entries(this.meta.outbox);
    if (sending.length > 0) {
      await this.remote.push(user, sending.map(([, change]) => change));
      check();
      // Keep anything changed again while it was being sent.
      for (const [key, change] of sending) {
        if (this.meta.outbox[key] === change) delete this.meta.outbox[key];
      }
      this.save();
    }

    if (pull) {
      const pulled = await this.remote.pull(user, this.meta.cursor);
      check();
      const local = this.host.getState();
      const merged = mergeRows(local, pulled, new Set(Object.keys(this.meta.outbox)));
      if (!sameState(merged, local)) this.host.setState(merged);
      this.meta.cursor = pulled.cursor;
      this.save();
    }
  }

  private schedule(delay: number, pull: boolean) {
    if (!this.user) return;
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sync({ pull });
    }, delay);
  }

  private cancelTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private pendingCount() {
    return Object.keys(this.meta.outbox).length;
  }

  private save() {
    this.store.save(JSON.stringify(this.meta));
    this.update({ pending: this.pendingCount() });
  }

  private update(changes: Partial<SyncSnapshot>) {
    const next = { ...this.snapshot, ...changes };
    if (
      next.syncedUser === this.snapshot.syncedUser &&
      next.status === this.snapshot.status &&
      next.pending === this.snapshot.pending
    ) {
      return;
    }
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}
