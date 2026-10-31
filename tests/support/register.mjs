// Loaded with `node --import` so unit tests can use the app's `@/` import alias.
// Node strips TypeScript types natively (Node 22.18+), so no build step is needed.
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
