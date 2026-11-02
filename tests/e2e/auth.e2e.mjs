import assert from 'node:assert/strict';

import { habit, saved, scenario, TEST_CODE, TEST_EMAIL, TEST_LONG_CODE } from './support/app.mjs';

scenario('new user signs in with an email code, then starts onboarding', { sanity: true, signedIn: false }, async (app) => {
  await app.expectPath('/onboarding');
  await app.see('Sign in to get started');
  await app.signIn();
  await app.see("Let's go");
  assert.deepEqual(app.authRequests, [`/auth/v1/otp ${TEST_EMAIL}`, `/auth/v1/verify ${TEST_EMAIL}`]);
  assert.equal((await app.savedSession())?.user.email, TEST_EMAIL);

  await app.reload();
  await app.see("Let's go");
  await app.dontSee('Sign in to get started');
});

// Regression: the real project sends 8-digit codes, and the input used to stop at 6.
scenario('signs in with an 8-digit code', { sanity: true, signedIn: false }, async (app) => {
  await app.signIn(TEST_EMAIL, TEST_LONG_CODE);
  await app.see("Let's go");
});

scenario('returning user signs back in and keeps their habits', { sanity: true, signedIn: false, storage: saved([habit('Read')]) }, async (app) => {
  await app.expectPath('/onboarding');
  await app.see('Welcome back');
  await app.signIn();
  await app.expectPath('/');
  await app.see('Read');
});

scenario('signing out returns to sign-in and keeps habits on the device', { sanity: true, storage: saved([habit('Read')]) }, async (app) => {
  await app.openTab('Settings');
  await app.see(`Signed in as ${TEST_EMAIL}`);
  await app.tap('Sign out');
  await app.expectPath('/onboarding');
  await app.see('Welcome back');
  assert.equal(await app.savedSession(), null);
  assert.equal((await app.savedState()).habits.length, 1);
  assert.ok(app.authRequests.includes('/auth/v1/logout'));
});

scenario('a wrong code shows an error and can be retried', { signedIn: false }, async (app) => {
  await app.page.getByLabel('Email', { exact: true }).fill(TEST_EMAIL);
  await app.tap('Send code');
  const code = app.page.getByLabel('Code', { exact: true });
  await code.fill('000000');
  await app.tap('Sign in', { exact: true });
  await app.see('That code is wrong or has expired');
  await code.fill(TEST_CODE);
  await app.tap('Sign in', { exact: true });
  await app.see("Let's go");
});

scenario('send code needs a valid email; sign in needs at least 6 digits', { signedIn: false }, async (app) => {
  const email = app.page.getByLabel('Email', { exact: true });
  await email.fill('not-an-email');
  await app.expectDisabled('Send code');
  await email.fill(`  ${TEST_EMAIL.toUpperCase()} `);
  await app.tap('Send code');
  assert.deepEqual(app.authRequests, [`/auth/v1/otp ${TEST_EMAIL}`], 'email is trimmed and lowercased');
  await app.page.getByLabel('Code', { exact: true }).fill('12a34');
  assert.equal(await app.page.getByLabel('Code', { exact: true }).inputValue(), '1234', 'only digits are kept');
  await app.expectDisabled('Sign in', { exact: true });
  await app.page.getByLabel('Code', { exact: true }).fill('123456789012');
  assert.equal(await app.page.getByLabel('Code', { exact: true }).inputValue(), '1234567890', 'at most 10 digits');
});

scenario('can resend the code or change the email', { signedIn: false }, async (app) => {
  await app.page.getByLabel('Email', { exact: true }).fill(TEST_EMAIL);
  await app.tap('Send code');
  await app.see(`we sent to ${TEST_EMAIL}`);
  await app.tap('Send a new code');
  await app.see('New code sent.');
  assert.equal(app.authRequests.filter((r) => r.startsWith('/auth/v1/otp')).length, 2);
  await app.tap('Use a different email');
  await app.see('Send code');
  await app.dontSee('New code sent.');
});

scenario('main screens are unreachable while signed out', { signedIn: false, storage: saved([habit('Read')]) }, async (app) => {
  for (const path of ['/', '/progress', '/settings', '/habit-editor']) {
    await app.goto(path);
    await app.expectPath('/onboarding');
    await app.see('Welcome back');
  }
});
