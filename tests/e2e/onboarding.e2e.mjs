import assert from 'node:assert/strict';

import { scenario } from './support/app.mjs';

async function toPickStep(app) {
  await app.see("Let's go");
  await app.tap("Let's go");
  await app.see('Pick your habits');
}

scenario('fresh install completes onboarding and starts a 3-day challenge', { sanity: true }, async (app) => {
  await app.expectPath('/onboarding');
  await toPickStep(app);
  await app.see('Continue with 2');
  await app.tap('Continue with 2');
  await app.see('Stay on track');
  await app.tap('Continue');
  await app.see('Your first challenge');
  await app.tap('Start my 3-day challenge');
  await app.expectPath('/');
  await app.see('Day 1 of 3');
  await app.see('Drink water');
  await app.see('Read for 20 minutes');
  await app.see('0 of 2 done');
  const state = await app.savedState();
  assert.equal(state.onboarded, true);
  assert.equal(state.habits.length, 2);
});

scenario('choosing habits: toggle, add custom, no duplicates', {}, async (app) => {
  await toPickStep(app);
  await app.tap('Meditate', { exact: true });
  await app.see('Continue with 3');
  await app.tap('Drink water', { exact: true });
  await app.see('Continue with 2');

  const input = app.page.getByPlaceholder('Add your own…');
  await input.fill('  meditate ');
  await input.press('Enter');
  await app.see('Continue with 2');
  assert.equal(await app.count('Meditate'), 1, 'typing an existing name does not duplicate it');

  await input.fill('Floss');
  await app.tap('Add', { exact: true });
  await app.see('Continue with 3');
  await app.see('Floss');
});

scenario('cannot continue without picking a habit', {}, async (app) => {
  await toPickStep(app);
  await app.tap('Drink water', { exact: true });
  await app.tap('Read for 20 minutes', { exact: true });
  await app.see('Pick at least one');
  await app.expectDisabled('Pick at least one');
});

scenario('back button returns to the previous step and keeps choices', {}, async (app) => {
  await toPickStep(app);
  await app.tap('Meditate', { exact: true });
  await app.tap('Continue with 3');
  await app.see('Stay on track');
  await app.tap('Back');
  await app.see('Continue with 3');
  await app.tap('Back');
  await app.see("Let's go");
});

scenario('reminder times chosen in onboarding are saved', {}, async (app) => {
  await toPickStep(app);
  await app.tap('Continue with 2');
  await app.see('Reminders are delivered by the iOS and Android apps');
  await app.page.getByRole('radio', { name: 'Off' }).first().click();
  await app.page.getByRole('radio', { name: '9:00 PM' }).click();
  await app.tap('Continue');
  await app.tap('Start my 3-day challenge');
  await app.see('Day 1 of 3');
  const state = await app.savedState();
  assert.deepEqual(state.settings.reminders, { morning: null, evening: '21:00' });
});

scenario('main screens are unreachable before onboarding', {}, async (app) => {
  for (const path of ['/', '/progress', '/settings', '/habit-editor']) {
    await app.goto(path);
    await app.expectPath('/onboarding');
  }
});
