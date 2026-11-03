// A fake Supabase for browser tests, so they never reach the real project or need a real email.
// It answers the auth endpoints the app uses and the slice of the REST (PostgREST) API that
// src/lib/sync-remote.ts calls, and reports anything else as a problem that fails the test.

export const TEST_EMAIL = 'tester@example.com';
export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
/** Codes the fake server accepts. Supabase sends 6–10 digits depending on a project setting. */
export const TEST_CODE = '123456';
export const TEST_LONG_CODE = '12345678';
export const AUTH_KEY = 'auth:v1'; // storageKey in src/lib/supabase.web.ts
export const SUPABASE_URL = /^https:\/\/[^/]+\.supabase\.co\//;

export function fakeSession(email = TEST_EMAIL) {
  const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  const user = {
    id: TEST_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  };
  return {
    access_token: `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: user.id, email, role: 'authenticated', exp: expiresAt })}.test`,
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: expiresAt - Math.floor(Date.now() / 1000),
    expires_at: expiresAt,
    user,
  };
}

/** The user a `Bearer <jwt>` header is for, or null (e.g. the publishable key: signed out). */
function tokenUser(authorization) {
  try {
    const payload = authorization?.replace(/^Bearer /, '').split('.')[1];
    return payload ? JSON.parse(Buffer.from(payload, 'base64url').toString()).sub ?? null : null;
  } catch {
    return null;
  }
}

/** Primary key columns, as in supabase/migrations. */
const Keys = {
  profiles: ['user_id'],
  habits: ['user_id', 'id'],
  habit_logs: ['user_id', 'habit_id', 'day'],
  badges: ['user_id', 'length', 'earned_on'],
};

/**
 * Account rows for `habits` (made with `habit()`), like `saved()` but on the server. Mirrors
 * toRows in src/lib/sync.ts.
 */
export function account(habits, overrides = {}) {
  const state = {
    onboarded: true,
    challenge: null,
    badges: [],
    settings: { sound: false, reminders: { morning: '08:00', evening: '20:00' } },
    celebratedPerfectDay: null,
    ...overrides,
  };
  return {
    profiles: [
      {
        onboarded: state.onboarded,
        sound: state.settings.sound,
        reminder_morning: state.settings.reminders.morning,
        reminder_evening: state.settings.reminders.evening,
        challenge_length: state.challenge?.length ?? null,
        challenge_started_on: state.challenge?.startedAt ?? null,
        celebrated_perfect_day: state.celebratedPerfectDay,
      },
    ],
    habits: habits.map((habit, position) => ({
      id: habit.id,
      name: habit.name,
      emoji: habit.emoji,
      color: habit.color,
      kind: habit.kind,
      target: habit.target,
      target_history: habit.targetHistory ?? [],
      intention_time: habit.intentionTime,
      created_on: habit.createdAt,
      position,
      deleted_at: null,
    })),
    habit_logs: habits.flatMap((habit) =>
      Object.entries(habit.log).map(([day, count]) => ({ habit_id: habit.id, day, count }))
    ),
    badges: state.badges.map((badge) => ({ length: badge.length, earned_on: badge.earnedAt })),
  };
}

export class FakeSupabase {
  /** Auth requests as `"<path> <email>"`, in order. */
  authRequests = [];
  /** table → key → row (with user_id and updated_at, like the real tables). */
  tables = { profiles: new Map(), habits: new Map(), habit_logs: new Map(), badges: new Map() };
  /** When false, database requests fail as if the network were down (auth still works). */
  online = true;
  #clock = 0;

  constructor(problems, seed = {}) {
    this.problems = problems;
    for (const [table, rows] of Object.entries(seed)) {
      for (const row of rows) this.write(table, { user_id: TEST_USER_ID, ...row });
    }
  }

  /** The user's rows in `table`, without user_id/updated_at. */
  rows(table) {
    return [...this.tables[table].values()].map(({ user_id, updated_at, ...row }) => row);
  }

  /** Writes a row the way another device would. */
  write(table, row) {
    const full = { user_id: TEST_USER_ID, ...row };
    const key = Keys[table].map((column) => full[column]).join('|');
    const time = Math.max(Date.now(), this.#clock + 1);
    this.#clock = time;
    this.tables[table].set(key, { ...this.tables[table].get(key), ...full, updated_at: new Date(time).toISOString() });
  }

  async attach(context) {
    await context.route(SUPABASE_URL, (route) => this.#handle(route));
  }

  #handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (status, data) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (path.startsWith('/auth/v1/')) {
      const body = request.postDataJSON?.() ?? {};
      this.authRequests.push(`${path} ${body.email ?? ''}`.trim());
      if (path === '/auth/v1/otp') return json(200, {});
      if (path === '/auth/v1/verify') {
        return body.token === TEST_CODE || body.token === TEST_LONG_CODE
          ? json(200, fakeSession(body.email))
          : json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
    }

    const table = path.match(/^\/rest\/v1\/(\w+)$/)?.[1];
    if (table && this.tables[table]) {
      if (!this.online) return route.abort('internetdisconnected');
      if (tokenUser(request.headers().authorization) !== TEST_USER_ID) {
        this.problems.push(`database request without the user's token: ${request.method()} ${path}`);
        return json(401, {});
      }
      const filters = [...url.searchParams.entries()].filter(([name]) => !['select', 'order', 'offset', 'limit', 'on_conflict', 'columns'].includes(name));
      const matches = (row) =>
        filters.every(([column, filter]) => {
          const [op, value] = [filter.slice(0, filter.indexOf('.')), filter.slice(filter.indexOf('.') + 1)];
          if (op === 'eq') return String(row[column]) === value;
          if (op === 'gt') return String(row[column]) > value;
          this.problems.push(`unsupported filter ${column}=${filter}`);
          return false;
        });

      if (request.method() === 'GET') {
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 1000);
        const rows = [...this.tables[table].values()]
          .filter(matches)
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
          .slice(offset, offset + limit);
        return json(200, rows);
      }
      if (request.method() === 'POST') {
        if (!request.headers().prefer?.includes('resolution=merge-duplicates')) {
          this.problems.push(`insert into ${table} is not an upsert`);
        }
        const body = request.postDataJSON();
        for (const row of Array.isArray(body) ? body : [body]) {
          if (row.user_id !== TEST_USER_ID) this.problems.push(`${table} row for another user: ${row.user_id}`);
          if (table === 'habit_logs' && !this.tables.habits.has(`${row.user_id}|${row.habit_id}`)) {
            // The real foreign key rejects this; it means logs were sent before their habit.
            this.problems.push(`habit_logs row for missing habit ${row.habit_id}`);
            return json(409, { code: '23503', message: 'violates foreign key constraint' });
          }
          this.write(table, row);
        }
        return route.fulfill({ status: 201 });
      }
      if (request.method() === 'DELETE') {
        for (const [key, row] of this.tables[table]) if (matches(row)) this.tables[table].delete(key);
        return route.fulfill({ status: 204 });
      }
    }

    this.problems.push(`unexpected Supabase request: ${request.method()} ${path}`);
    return json(404, {});
  }
}
