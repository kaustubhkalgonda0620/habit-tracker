import assert from 'node:assert/strict';

import { account, day, habit, saved, scenario } from './support/app.mjs';

scenario('changes are saved to the account', { sanity: true, storage: saved([habit('Read'), habit('Walk')]) }, async (app) => {
  await app.logHabit('Read');
  await app.serverHas('habit_logs', (rows) => rows.some((row) => row.habit_id === 'Read' && row.day === day(0) && row.count === 1), 'today’s log');
  await app.openTab('Settings');
  await app.see('Everything is saved to your account');
});

scenario('a new device signs in and loads the account’s habits', { sanity: true, signedIn: false, account: account([habit('From my phone', { log: { [day(-1)]: 1 } })]) }, async (app) => {
  await app.see('Sign in to get started');
  await app.signIn();
  await app.expectPath('/');
  await app.see('From my phone');
  const state = await app.savedState();
  assert.deepEqual(state.habits.map((h) => [h.name, h.log]), [['From my phone', { [day(-1)]: 1 }]]);
});

scenario('on first sign-in, the account’s data wins over this device’s', { storage: saved([habit('On this device')]), account: account([habit('In the account')]) }, async (app) => {
  await app.see('In the account');
  await app.dontSee('On this device');
  assert.equal(app.supabase.rows('habits').some((row) => row.name === 'On this device'), false);
});

scenario('a fresh account gets this device’s onboarding', { signedIn: false }, async (app) => {
  await app.signIn();
  await app.tap("Let's go");
  await app.tap('Continue with 2');
  await app.tap('Continue');
  await app.tap('Start my 3-day challenge');
  await app.see('Day 1 of 3');
  await app.serverHas('habits', (rows) => rows.length === 2);
  await app.serverHas('profiles', ([profile]) => profile?.onboarded === true && profile.challenge_length === 3);
});

scenario('offline changes stay on the device and sync once back online', { storage: saved([habit('Read'), habit('Walk')]) }, async (app) => {
  await app.serverHas('habits', (rows) => rows.length === 2);
  app.supabase.online = false;
  await app.logHabit('Read');
  await app.openTab('Settings');
  await app.see("Can't reach the server");
  assert.equal(app.supabase.rows('habit_logs').length, 0);

  app.supabase.online = true;
  await app.tap('Try again', { exact: true });
  await app.see('Everything is saved to your account');
  await app.serverHas('habit_logs', (rows) => rows.length === 1);
});

scenario('signing out with unsaved changes asks first', { storage: saved([habit('Read'), habit('Walk')]) }, async (app) => {
  await app.serverHas('habits', (rows) => rows.length === 2);
  app.supabase.online = false;
  await app.logHabit('Read');
  await app.openTab('Settings');
  await app.tap('Sign out');
  await app.eventually(() => assert.match(app.dialogs.join(), /haven't been saved to your account/));
  await app.expectPath('/onboarding');
});

scenario('changes from another device show up', { storage: saved([habit('Read')]) }, async (app) => {
  await app.serverHas('habits', (rows) => rows.length === 1);
  const [read] = app.supabase.rows('habits');
  app.supabase.write('habits', { ...read, name: 'Read a book' });
  app.supabase.write('habits', { ...read, id: 'walk', name: 'Walk', position: 1 });
  app.supabase.write('habit_logs', { habit_id: 'walk', day: day(0), count: 1 });
  await app.reload();
  await app.see('Read a book');
  await app.see('Walk');
  await app.see('1 of 2 done');

  app.supabase.write('habits', { ...read, id: 'walk', name: 'Walk', position: 1, deleted_at: new Date().toISOString() });
  await app.reload();
  await app.see('Read a book');
  await app.dontSee('Walk');
});

scenario('deleting a habit and starting over reach the account', { storage: saved([habit('Read'), habit('Walk')], { badges: [{ length: 3, earnedAt: day(-3) }] }) }, async (app) => {
  await app.serverHas('badges', (rows) => rows.length === 1);
  await app.longPress('Walk');
  await app.tap('Delete habit');
  await app.serverHas('habits', (rows) => rows.find((row) => row.id === 'Walk')?.deleted_at);

  await app.openTab('Settings');
  await app.tap('Start over');
  await app.serverHas('habits', (rows) => rows.every((row) => row.deleted_at), 'every habit deleted');
  await app.serverHas('badges', (rows) => rows.length === 0, 'badges deleted');
  await app.serverHas('profiles', ([profile]) => profile.onboarded === false);
});

scenario('a new device waits for the account and can retry when offline', { signedIn: false, account: account([habit('Read')]) }, async (app) => {
  app.supabase.online = false;
  await app.signIn();
  await app.see("Couldn't load your account");
  await app.dontSee("Let's go");
  app.supabase.online = true;
  await app.tap('Try again', { exact: true });
  await app.expectPath('/');
  await app.see('Read');
});
