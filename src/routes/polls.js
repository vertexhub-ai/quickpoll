import { createPoll, recordVote } from '../db/queries.js';

export default async function pollRoutes(fastify) {
  fastify.post('/polls', async (req, reply) => {
    const { question, options } = req.body ?? {};
    const raw = Array.isArray(options) ? options : options ? [options] : [];
    const filtered = raw.map(o => o?.trim()).filter(Boolean);

    if (!question?.trim()) {
      return reply.code(400).send('Question is required');
    }
    if (filtered.length < 2) {
      return reply.code(400).send('At least 2 options are required');
    }
    if (filtered.length > 5) {
      return reply.code(400).send('At most 5 options are allowed');
    }

    const pollId = await createPoll(question.trim(), filtered);
    reply.redirect(`/?poll=${pollId}`);
  });

  fastify.post('/polls/:id/vote', async (req, reply) => {
    const pollId = parseInt(req.params.id, 10);
    const optionId = parseInt(req.body?.optionId, 10);
    if (!optionId) {
      return reply.code(400).send('Option is required');
    }
    await recordVote(pollId, optionId);
    reply.redirect(`/?poll=${pollId}`);
  });
}
