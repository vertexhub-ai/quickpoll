import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import formbody from '@fastify/formbody';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run all SQL migrations in order (idempotent — use IF NOT EXISTS in your SQL).
async function migrate(sql) {
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.sql')) continue;
    await sql.unsafe(readFileSync(join(dir, f), 'utf8'));
  }
}

// NCI-2: convention-based route auto-registration. Every file in src/routes/
// that default-exports a Fastify plugin is registered automatically — agents
// add a route by DROPPING A FILE, with ZERO edits to this shared file (no
// merge conflicts, no LLM wiring). Do not hand-register routes here.
async function registerRoutes(app) {
  const dir = join(__dirname, 'routes');
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  } catch {
    return;
  }
  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const plugin = mod.default;
    if (typeof plugin === 'function') {
      await app.register(plugin);
    }
  }
}

export async function buildApp(opts = {}) {
  const app = Fastify({ logger: opts.logger ?? true });

  // GOTCHA (baked-in lesson): decorateReply MUST be true so reply.sendFile works.
  await app.register(fastifyStatic, {
    root: join(__dirname, '..', 'public'),
    prefix: '/static',
    decorateReply: true,
  });

  await app.register(formbody);

  await registerRoutes(app);

  return app;
}

async function main() {
  // SMOKE_MODE: boot probe used by the integration gate (G2). Skip the DB
  // connect + migrations and just register routes + listen, so the gate can
  // verify the server actually binds a port and answers GET /api/health
  // WITHOUT needing an ephemeral database. Catches the "entrypoint never
  // listens / wrong CMD / crashes on boot" class (the HookRelay bug).
  // The `postgres()` client in db/client.js is lazy, so importing routes here
  // does not open a connection — only real requests would.
  const smoke = process.env.SMOKE_MODE === '1';
  if (!smoke) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('DATABASE_URL is required');
      process.exit(1);
    }
    const sql = postgres(databaseUrl, { max: 1 });
    await migrate(sql);
    await sql.end();
    console.log('Migrations applied.');
  } else {
    console.log('SMOKE_MODE: skipping DB connect + migrations (boot probe only).');
  }

  const app = await buildApp();
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.HOST ?? '0.0.0.0';
  // GOTCHA: the entrypoint MUST actually listen — a stub that only exports
  // buildApp exits immediately and crash-loops in k8s.
  await app.listen({ port, host });
  console.log(`quickpoll listening on ${host}:${port}`);
}

// Only run when executed directly (not imported by tests or other modules)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
