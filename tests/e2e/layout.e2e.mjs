import { day, habit, saved, scenario } from './support/app.mjs';

const data = saved(
  [
    habit('Drink water', { emoji: '💧', kind: 'count', target: 8, log: { [day(0)]: 3, [day(-1)]: 8 } }),
    habit('Read for 20 minutes', { emoji: '📚', intentionTime: '21:00', log: { [day(-1)]: 1 } }),
  ],
  { challenge: { length: 3, startedAt: day(-1) } }
);

async function everyScreen(app, check) {
  for (const path of ['/', '/progress', '/settings', '/habit-editor']) {
    await app.goto(path);
    await app.settle(500);
    await check(path);
  }
}

scenario('no screen is wider than a phone', { sanity: true, storage: data, viewport: { width: 375, height: 812 } }, async (app) => {
  await everyScreen(app, () => app.expectNoHorizontalOverflow());
});

scenario('onboarding fits a small phone', { viewport: { width: 320, height: 640 } }, async (app) => {
  await app.expectNoHorizontalOverflow();
  await app.tap("Let's go");
  await app.expectNoHorizontalOverflow();
  await app.tap('Continue with 2');
  await app.expectNoHorizontalOverflow();
});

scenario('dark mode renders every screen', { storage: data, colorScheme: 'dark' }, async (app) => {
  await everyScreen(app, async (path) => {
    await app.expectNoHorizontalOverflow();
    await app.screenshot(`dark${path.replace(/\//g, '-') || '-today'}`);
  });
});

scenario('desktop width keeps content centered and readable', { storage: data, viewport: { width: 1280, height: 900 } }, async (app) => {
  await everyScreen(app, async (path) => {
    await app.expectNoHorizontalOverflow();
    await app.screenshot(`desktop${path.replace(/\//g, '-') || '-today'}`);
  });
});
