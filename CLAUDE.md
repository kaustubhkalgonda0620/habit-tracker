# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

"Habit Tracker" — an Expo SDK 58 app (React Native 0.88, React 19.3, Expo Router, React Compiler and typed routes enabled) that runs on iOS, Android, and web. It uses npm (`package-lock.json`), so use `npx`, not `bunx`. Requires Node 22.18+.

## Commands

```bash
npx expo start            # dev server (npm run ios | android | web for a specific platform)
npx expo lint             # ESLint (eslint-config-expo flat config)
npx tsc --noEmit          # typecheck (also: npm run typecheck)
npm run test:sanity       # priority-1 tests, unit + browser (npm test does the same); for small changes
npm run test:full         # every test; for bigger changes
npm run test:unit         # full unit layer only (test:e2e = full browser layer only)
node tests/run.mjs sanity --headed   # watch the browser while e2e runs

# a single file / single test
node --import ./tests/support/register.mjs --test tests/unit/dates.test.ts
node --import ./tests/support/register.mjs --test --test-name-pattern="streak" tests/unit/habits.test.ts
node --test tests/e2e/today.e2e.mjs   # needs `npm run web` already serving BASE_URL (default :8081)
```

Don't run `npm run reset-project`. It's left over from the Expo template and moves the whole app out of `src/app`.

**Tests.** Layout, harness (`scenario()`, fixtures), requirements, and coverage are in `tests/README.md`. The rules that shape code:
- Unit tests (`tests/unit`, plain Node with `tests/support/register.mjs` resolving `@/`) can't import React Native or Expo native modules, which is why app logic lives in pure modules (`lib/app-state.ts`, `lib/reminder-plan.ts`) rather than in the provider or `reminders.ts`.
- When you change behavior, add or update tests. Prefix the name with `@sanity` if a user would be blocked or lose data if it broke; everything else runs only in the full suite.
- Browser tests (`tests/e2e`, Chrome only) fail on *any* console error or uncaught exception, including React warnings.
- Browser tests never reach the real Supabase: the harness answers `*.supabase.co` requests with a fake auth server (codes `123456` and `12345678`) and fails on any request it doesn't handle. Scenarios start signed in with a seeded session; pass `signedIn: false` to start at sign-in. Extend the fake when the app calls new Supabase endpoints.
- Don't edit project files while browser tests run: Metro rescans and can briefly serve 500s.

## Architecture

**Routing.** `src/app/_layout.tsx` is the root: it wraps everything in the navigation `ThemeProvider`, `AuthProvider` and `HabitsProvider`, then renders a `Stack`. `Stack.Protected` on `onboarded && signed in` chooses between `onboarding.tsx` and the rest: the `(tabs)` group (`index` = Today, `progress`, `settings`, laid out by `AppTabs`) plus the `habit-editor` (modal) and `celebrate` (transparent modal) screens. The root also shows queued celebrations and renders nothing until hydrated on web (storage isn't visible to the server render) and until the saved auth session has loaded. Sign-in (email + one-time code, 6–10 digits depending on the Supabase setting; `components/sign-in.tsx`) is the first onboarding step; a signed-out user who already onboarded sees only that step, then returns to their data. The app is deliberately capped at 6 screens. Adding a tab means adding a route file in `(tabs)/` *and* registering it in both tab implementations (below).

**Platform-specific files.** Several modules have a `.web.tsx`/`.web.ts` twin that Metro picks automatically on web. Keep the exported API of each pair identical:
- `components/app-tabs.tsx` uses `NativeTabs` from `expo-router/native-tabs`; `app-tabs.web.tsx` builds a custom top bar with `expo-router/ui` (`Tabs`, `TabList`, `TabTrigger`, `TabSlot`).
- `lib/reminders.ts` schedules local notifications with `expo-notifications`; `lib/reminders.web.ts` is a no-op because web can't schedule them.
- `lib/storage.ts` uses `expo-sqlite/kv-store` (synchronous); `lib/storage.web.ts` uses `localStorage` because expo-sqlite needs extra wasm setup on web.
- `lib/supabase.ts` keeps the auth session in expo-sqlite's `localStorage` and refreshes tokens only in the foreground; `lib/supabase.web.ts` uses the browser's `localStorage`, and an in-memory session during the server render. Both use storage key `auth:v1`.
- `hooks/use-color-scheme` and `components/animated-icon` also have web variants.

**State.** All app data lives in `hooks/use-habits.tsx`: a React context holding `AppState` (habits, challenge, badges, settings), initialized synchronously from storage (key `app:v2`, JSON; v1 `habits:v1` data is migrated), falling back to a fresh, not-onboarded state when empty or corrupt, and re-saved on every change. The transitions themselves are pure functions in `lib/app-state.ts`; the provider commits them, plays feedback (`lib/feedback.ts`: haptics + `assets/sounds/`), queues celebrations, and re-syncs reminders. It also exposes `today`/`todayKey` (from `hooks/use-today.ts`), which roll over at midnight and when the app returns to the foreground. Use them instead of `new Date()` in render, because React Compiler may memoize it. Components get data and mutations via `useHabits()`. If the state shape changes incompatibly, bump the storage key or migrate.

**Domain logic** is pure and lives in `src/lib/`:
- `habits.ts`: the `Habit` type (`check` once a day or `count` toward a daily `target`; `targetHistory` keeps old targets so edits don't rewrite past days), palette/emoji options, streak and completion-rate calculations, and deterministic sample data.
- `challenges.ts`: 3/7/21-day challenges (consecutive "perfect days" where every habit is done) and their badges.
- `app-state.ts` / `reminder-plan.ts`: pure state transitions and the reminder schedule (see State).
- `dates.ts` — days are represented as local-time `YYYY-MM-DD` "date keys" (`toDateKey`/`parseDateKey`); completions are stored as arrays of date keys, and string comparison of keys is used for ordering.
- `confirm.ts` — cross-platform destructive confirmation (`window.confirm` on web, `Alert.alert` on native).

**Theming & layout.** `constants/theme.ts` defines `Colors` (light/dark), `Spacing`, `Fonts`, `BottomTabInset`, and `MaxContentWidth`. Use `ThemedText`/`ThemedView` and `useTheme()` rather than hard-coded colors. Screens wrap their content in `ScreenScrollView`, which handles safe-area insets, tab-bar clearance, the web top bar offset, and max content width.

**Backend (in progress).** Sign-in is required (`hooks/use-auth.tsx` exposes `session` and `ready`; sign out is in Settings and keeps local data), but habit data is still device-only: sync is not built yet. `supabase/migrations/` holds the schema for the upcoming sync: normalized tables that mirror `AppState` (`profiles`, habits, logs, badges), each row owned by a user under row-level security, `updated_at` set by a DB trigger for incremental pulls, soft-deleted habits (`deleted_at`) so deletes reach other devices, and anon access revoked. Keep the migrations in step with `lib/app-state.ts` when the state shape changes. The client config is read from `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, which is gitignored.

**Imports** use the `@/` alias for `src/` and `@/assets/` for `assets/`.
