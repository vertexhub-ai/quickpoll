import postgres from 'postgres';
// Single shared connection pool. DATABASE_URL is injected from the
// quickpoll-secrets secret (key database-url).
export const sql = postgres(process.env.DATABASE_URL, { max: 10 });
