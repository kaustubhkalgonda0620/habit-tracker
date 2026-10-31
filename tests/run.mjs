#!/usr/bin/env node
// Runs a test suite: unit tests first, then browser (e2e) tests.
//
//   node tests/run.mjs sanity          priority-1 checks only (tests named "@sanity ...")
//   node tests/run.mjs full            everything
//   ... --unit | --e2e                 one layer only
//   ... --headed                       watch the browser
//
// If the web dev server isn't running at BASE_URL, it is started for the run and stopped after.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const suite = args.find((arg) => !arg.startsWith('--'));
if (suite !== 'sanity' && suite !== 'full') {
  console.error('Usage: node tests/run.mjs <sanity|full> [--unit|--e2e] [--headed]');
  process.exit(2);
}
const layers = args.includes('--unit') ? ['unit'] : args.includes('--e2e') ? ['e2e'] : ['unit', 'e2e'];
const baseUrl = process.env.BASE_URL ?? 'http://localhost:8081';
const filter = suite === 'sanity' ? ['--test-name-pattern=@sanity'] : [];

function run(command, commandArgs, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function isUp() {
  try {
    return (await fetch(baseUrl)).ok;
  } catch {
    return false;
  }
}

/** Starts `expo start --web` unless something is already serving BASE_URL. Returns a stop function. */
async function ensureServer() {
  if (await isUp()) return () => {};
  const port = new URL(baseUrl).port || '8081';
  console.log(`Starting the web dev server on port ${port}…`);
  const server = spawn(process.execPath, ['node_modules/expo/bin/cli', 'start', '--web', '--port', port], {
    cwd: root,
    env: { ...process.env, CI: '1', BROWSER: 'none' },
    stdio: 'ignore',
    detached: true,
  });
  const deadline = Date.now() + 120_000;
  while (!(await isUp())) {
    if (Date.now() > deadline || server.exitCode !== null) {
      throw new Error(`Dev server did not come up at ${baseUrl}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return () => process.kill(-server.pid);
}

const results = [];
const started = Date.now();

if (layers.includes('unit')) {
  console.log(`\n▶ ${suite} · unit\n`);
  const code = await run(process.execPath, [
    '--import',
    './tests/support/register.mjs',
    '--test',
    ...filter,
    'tests/unit/*.test.ts',
  ]);
  results.push(['unit', code]);
}

if (layers.includes('e2e')) {
  console.log(`\n▶ ${suite} · e2e (browser)\n`);
  let stop = () => {};
  try {
    stop = await ensureServer();
    const code = await run(
      process.execPath,
      ['--test', '--test-concurrency=3', ...filter, 'tests/e2e/*.e2e.mjs'],
      args.includes('--headed') ? { HEADED: '1' } : {}
    );
    results.push(['e2e', code]);
  } catch (error) {
    console.error(error.message);
    results.push(['e2e', 1]);
  } finally {
    stop();
  }
}

const seconds = Math.round((Date.now() - started) / 1000);
console.log(`\n${suite} suite finished in ${seconds}s`);
for (const [layer, code] of results) console.log(`  ${code === 0 ? '✔' : '✖'} ${layer}`);
process.exit(results.every(([, code]) => code === 0) ? 0 : 1);
