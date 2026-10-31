# Tests

Two suites, two layers.

| Command | What runs | When to use it |
|---|---|---|
| `npm run test:sanity` (or `npm test`) | Priority-1 checks only (`@sanity` tests), unit + browser | Small changes, before every commit |
| `npm run test:full` | Every test, unit + browser | Bigger changes, before merging or releasing |
| `npm run test:unit` | Full unit layer only | While working on logic in `src/lib/` |
| `npm run test:e2e` | Full browser layer only | While working on screens |

Add `--headed` to watch the browser, for example `node tests/run.mjs sanity --headed`.

The browser tests need the web dev server. If nothing is serving `BASE_URL` (default `http://localhost:8081`), the runner starts `expo start --web` for the run and stops it afterwards. If your own `npm run web` is already running, it's used as is.

**Requirements:** Node 22.18+ (TypeScript runs natively) and Google Chrome. Set `CHROME_PATH` if Chrome isn't at the standard macOS location.

## Layout

```
tests/
  run.mjs                 suite runner (sanity | full, --unit | --e2e, --headed)
  support/                lets Node resolve the app's `@/` imports
  unit/                   logic in src/lib, pinned to a fixed date
    fixtures.ts           builders: habit(), appState(), day(), edited()
    dates | habits | challenges | app-state | reminder-plan .test.ts
  e2e/                    the real app in Chrome, one file per area
    support/app.mjs       harness: scenario(), data builders, page helpers
    onboarding | today | editor | challenges | progress | settings |
    navigation-and-storage | layout .e2e.mjs
```

## What's covered

| Area | Sanity (priority 1) | Full adds |
|---|---|---|
| Onboarding | Fresh install → pick habits → reminders → 3-day challenge → Today | Toggle/add/dedupe habits, must pick one, Back keeps choices, reminder times saved, main screens locked until onboarded |
| Today | Check off / uncheck, count habit taps + undo, perfect-day celebration (once), logs survive reload | Rapid taps, empty state, streak and intention-time display |
| Habit editor | Create once-a-day and several-times habits, edit via long press (history kept), delete | Target limits 2–20, name required, Cancel discards, count → once a day, link to a missing habit |
| Challenges | Finish → badge → start next tier; missed day → restart | "Not now", day-by-day progress messages, finishing by deleting a habit, invitation states, top tier repeats |
| Progress | Stats, charts, badges, history render | Stat totals, heatmap and week-bar taps, history filter, "Show more", locked badges |
| Settings | Sections render, load demo data, start over | Sound and reminder times persist, preview celebration |
| Navigation & storage | Tab switching, reload with saved data (no hydration errors) | Direct URLs, onboarding locked after setup, bad celebration links, v1 migration, corrupt and partial data |
| Layout | No screen wider than a 375px phone | 320px onboarding, dark mode, desktop width |
| Logic (unit) | Done/streak rules, target edits, challenge complete/fail, log rewards, undo, onboarding, restore, reminders | Date edge cases (DST, month/year), formatting, ids, sample data, every reminder and restore edge case |

Every browser test also fails on any console error or uncaught exception, so crashes and React warnings surface even when the screen looks fine.

## Adding a test

**Put a test in sanity** if a user would be blocked or would lose data if it broke. Everything else goes in the full suite only.

Unit test (in `tests/unit/`):

```ts
test('@sanity streak resets after a missed day', () => { ... }); // sanity + full
test('best streak ignores future days', () => { ... });          // full only
```

Browser test (in `tests/e2e/`):

```js
scenario('logging a habit updates the count', { sanity: true, storage: saved([habit('Read')]) }, async (app) => {
  await app.logHabit('Read');
  await app.see('1 of 1 done');
});
```

`scenario` options: `sanity`, `storage` (seed data via `saved(...)`), `path`, `viewport`, `colorScheme`. Each scenario gets a fresh browser profile, so tests don't affect each other and run in parallel.

Logic that needs testing belongs in `src/lib/` as plain functions. Unit tests can't import React Native or Expo native modules.

## When something fails

- **Browser failures** print the page URL, any console errors and failed requests, and the path to a screenshot. Screenshots go to the system temp folder (`$TMPDIR/habit-tracker-e2e`, or set `E2E_SCREENSHOTS`).
- **Don't save files into the project while the browser tests run.** Metro rescans when files change, which can briefly make pages return a 500 and fail a test.
