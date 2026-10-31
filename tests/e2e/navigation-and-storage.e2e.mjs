import { day, habit, saved, scenario } from './support/app.mjs';

scenario('tabs switch between Today, Progress and Settings', { sanity: true, storage: saved([habit('A')]) }, async (app) => {
  await app.openTab('Progress');
  await app.expectPath('/progress');
  await app.see('Consistency');
  await app.openTab('Settings');
  await app.expectPath('/settings');
  await app.openTab('Today');
  await app.expectPath('/');
  await app.see('0 of 1 done');
});

scenario('each screen loads directly from its URL', { storage: saved([habit('A')]) }, async (app) => {
  for (const [path, text] of [['/progress', 'Consistency'], ['/settings', 'Sounds'], ['/habit-editor', 'New habit'], ['/', 'Today']]) {
    await app.goto(path);
    await app.see(text);
  }
});

scenario('onboarding is unreachable once onboarded', { storage: saved([habit('A')]), path: '/onboarding' }, async (app) => {
  await app.expectPath('/');
});

scenario('celebration link with bad parameters falls back to a perfect day', { storage: saved([habit('A')]), path: '/celebrate?kind=challenge&length=999' }, async (app) => {
  await app.see('Perfect day!');
  await app.tap('Nice!');
  await app.expectPath('/');
});

scenario('reloading with saved data shows it without errors', { sanity: true, storage: saved([habit('A', { log: { [day(0)]: 1 } }), habit('B')]) }, async (app) => {
  // A server/client mismatch here once broke every reload; the harness fails on console errors.
  await app.see('1 of 2 done');
  await app.reload();
  await app.see('1 of 2 done');
});

scenario('data from the first app version is migrated', { storage: { 'habits:v1': JSON.stringify([{ id: 'x', name: 'Old habit', emoji: '📚', color: '#3c87f7', createdAt: day(-3), completions: [day(-1), day(-2)] }]) } }, async (app) => {
  await app.see('Old habit');
  await app.see('2 day streak');
});

scenario('corrupt saved data starts fresh', { storage: { 'app:v2': '{not json' } }, async (app) => {
  await app.expectPath('/onboarding');
});

scenario('partially saved data still loads', { storage: { 'app:v2': JSON.stringify({ onboarded: true, habits: [] }) } }, async (app) => {
  await app.see('Add your first habit below');
  await app.openTab('Settings');
  await app.see('Morning check-in');
});
