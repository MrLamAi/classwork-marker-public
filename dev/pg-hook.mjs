// Module resolve hook: redirects `import pg from 'pg'` to the in-memory store.
// Registered by dev/server.mjs only when DATABASE_URL is absent.
const MEMORY = new URL('./memory-pg.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'pg') return { url: MEMORY, shortCircuit: true };
  return next(specifier, context);
}
