import { sql } from './client.js';

export async function createPoll(question, options) {
  const [poll] = await sql`INSERT INTO polls (question) VALUES (${question}) RETURNING id`;
  for (let i = 0; i < options.length; i++) {
    await sql`INSERT INTO poll_options (poll_id, label, position) VALUES (${poll.id}, ${options[i]}, ${i})`;
  }
  return poll.id;
}

export async function getPollWithResults(id) {
  const [poll] = await sql`SELECT id, question FROM polls WHERE id = ${id}`;
  if (!poll) return null;
  const options = await sql`
    SELECT po.id, po.label, po.position, COUNT(v.id)::int AS vote_count
    FROM poll_options po
    LEFT JOIN votes v ON v.option_id = po.id
    WHERE po.poll_id = ${id}
    GROUP BY po.id, po.label, po.position
    ORDER BY po.position
  `;
  const total = options.reduce((s, o) => s + o.vote_count, 0);
  return {
    ...poll,
    options: options.map(o => ({
      ...o,
      pct: total > 0 ? Math.round((o.vote_count / total) * 100) : 0,
    })),
    total,
  };
}

export async function getLatestPollId() {
  const [row] = await sql`SELECT id FROM polls ORDER BY created_at DESC LIMIT 1`;
  return row?.id ?? null;
}

export async function recordVote(pollId, optionId) {
  await sql`INSERT INTO votes (poll_id, option_id) VALUES (${pollId}, ${optionId})`;
}
