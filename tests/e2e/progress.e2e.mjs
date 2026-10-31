import { day, habit, saved, scenario } from './support/app.mjs';

const history = saved(
  [
    habit('Read', { emoji: '📚', log: { [day(-1)]: 1, [day(-2)]: 1, [day(-3)]: 1 } }),
    habit('Water', { emoji: '💧', kind: 'count', target: 4, log: { [day(-1)]: 4, [day(0)]: 2 } }),
  ],
  { badges: [{ length: 3, earnedAt: day(-1) }] }
);

scenario('progress shows stats, charts, badges, and history', { sanity: true, storage: history }, async (app) => {
  await app.openTab('Progress');
  await app.see('Last 30 days');
  await app.see('Completion');
  await app.see('Best streak');
  await app.see('Total logs');
  await app.see('Consistency');
  await app.see('Weekly completion');
  await app.see('Badges');
  await app.see('Spark');
  await app.see('By habit');
  await app.see('History');
  await app.see('2/4'); // today's partial count in the log
});

scenario('stat tiles add up', { storage: history }, async (app) => {
  await app.openTab('Progress');
  await app.see('9', { exact: true }); // 3 reads + 4 + 2 water logs
  await app.see('3', { exact: true }); // best streak
});

scenario('tapping a heatmap day shows its details', { storage: history }, async (app) => {
  await app.openTab('Progress');
  await app.see('Tap a day for details');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const label = yesterday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  await app.page.getByLabel(label, { exact: true }).click();
  await app.see(`${label}: 2 of 2 habits done`);
});

scenario('tapping a week bar shows that week', { storage: history }, async (app) => {
  await app.openTab('Progress');
  await app.see('so far');
  await app.page.locator('[aria-label^="Week of"]').first().click();
  await app.see('no habits yet');
});

scenario('history can be filtered by habit', { storage: history }, async (app) => {
  // Three days ago only Read was logged, so its date heading tracks the filter.
  const date = new Date();
  date.setDate(date.getDate() - 3);
  const readOnlyDay = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  await app.openTab('Progress');
  await app.see(readOnlyDay);
  await app.page.getByRole('radio', { name: '💧 Water' }).click();
  await app.see('4/4 ✓');
  await app.dontSee(readOnlyDay);
  await app.page.getByRole('radio', { name: 'All' }).click();
  await app.see(readOnlyDay);
});

scenario('long history pages with "Show more"', { storage: saved([habit('Daily', { createdAt: day(-40), log: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [day(-i - 1), 1])) })]) }, async (app) => {
  await app.openTab('Progress');
  await app.see('Show more');
  await app.tap('Show more');
  await app.tap('Show more');
  await app.dontSee('Show more');
});

scenario('locked badges are shown for tiers not yet earned', { storage: saved([habit('A')]) }, async (app) => {
  await app.openTab('Progress');
  await app.see('🔒');
  await app.see('Nothing logged yet');
});
