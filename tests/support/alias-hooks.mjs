// Resolves `@/x` to `src/x.ts` (mirroring the `paths` entry in tsconfig.json) and lets relative
// imports between test files omit the `.ts` extension, as TypeScript expects.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const srcRoot = fileURLToPath(new URL('../../src/', import.meta.url));

function firstExisting(base) {
  return [`${base}.ts`, `${base}.tsx`, base].find((candidate) => existsSync(candidate));
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const found = firstExisting(srcRoot + specifier.slice(2));
    if (found) return next(pathToFileURL(found).href, context);
  }
  if (specifier.startsWith('.') && context.parentURL && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const found = firstExisting(fileURLToPath(new URL(specifier, context.parentURL)));
    if (found) return next(pathToFileURL(found).href, context);
  }
  return next(specifier, context);
}
