# Habit Tracker

A small habit tracker for iOS, Android, and the web, built with Expo (SDK 58) and Expo Router.

- **Today:** check off once-a-day habits, or tap count habits toward a daily target.
- **Challenges:** 3, 7, and 21-day runs of "perfect days" (every habit done), with badges for finishing.
- **Progress:** streaks, completion rates, a heatmap, weekly charts, and history.
- **Reminders:** local notifications at the times you choose (iOS and Android).
- **Celebrations:** confetti, haptics, and sounds for perfect days and badges.

You sign in with your email and a one-time code (Supabase Auth). Your habits are kept on the device (SQLite key-value store on native, `localStorage` on web), so the app is fast and works offline, and synced to your account in the background, so they follow you to other devices. Signing out removes them from the device.

To run it, put your Supabase project's `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.

## Getting started

Requires Node 22.18+ and npm.

```bash
npm install
npx expo start
```

Then press `i`, `a`, or `w` for the iOS simulator, Android emulator, or web. To run it on your phone, scan the QR code with Expo Go.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the dev server |
| `npm run ios` / `android` / `web` | Start and open on one platform |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` / `npm run test:sanity` | Priority-1 tests, unit + browser |
| `npm run test:full` | Every test |
| `npm run test:unit` / `test:e2e` | One test layer only |

Browser tests drive a local Google Chrome with `playwright-core`, and start the web dev server themselves if it isn't running. See [tests/README.md](tests/README.md).

## Project layout

```
src/app/         routes (Expo Router): onboarding, (tabs)/ Today · Progress · Settings, habit-editor, celebrate
src/components/  UI components (some have .web.tsx variants)
src/hooks/       use-habits (app state provider), theme, today
src/lib/         pure domain logic: habits, challenges, dates, state transitions, reminder plan, storage
assets/          images and sounds
tests/           unit (Node test runner) and e2e (Chrome) tests
```

## License

MIT. See [LICENSE](LICENSE).
