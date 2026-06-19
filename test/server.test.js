import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

vi.mock('../src/db/queries.js', () => ({
  getLatestPollId: vi.fn().mockResolvedValue(null),
  getPollWithResults: vi.fn().mockResolvedValue(null),
  createPoll: vi.fn().mockResolvedValue(42),
  recordVote: vi.fn().mockResolvedValue(undefined),
}));

// Also stub the postgres client so it never tries to connect
vi.mock('../src/db/client.js', () => ({ sql: null }));

import { buildApp } from '../src/server.js';

let app;

beforeAll(async () => {
  app = await buildApp({ logger: false });
});

afterAll(async () => {
  await app.close();
});

describe('GET /', () => {
  it('returns HTTP 200 with non-empty HTML', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<h1>QuickPoll</h1>');
    expect(res.body.length).toBeGreaterThan(200);
  });

  it('renders create-poll form', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.body).toContain('action="/polls"');
    expect(res.body).toContain('name="question"');
    expect(res.body).toContain('name="options"');
  });

  it('shows poll data when one exists', async () => {
    const { getLatestPollId, getPollWithResults } = await import('../src/db/queries.js');
    getLatestPollId.mockResolvedValueOnce(1);
    getPollWithResults.mockResolvedValueOnce({
      id: 1,
      question: 'Favorite color?',
      options: [
        { id: 1, label: 'Red', vote_count: 3, pct: 60, position: 0 },
        { id: 2, label: 'Blue', vote_count: 2, pct: 40, position: 1 },
      ],
      total: 5,
    });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Favorite color?');
    expect(res.body).toContain('3 votes');
    expect(res.body).toContain('60%');
  });

  it('renders cleanly even when DB is unavailable', async () => {
    const { getLatestPollId } = await import('../src/db/queries.js');
    getLatestPollId.mockRejectedValueOnce(new Error('db down'));
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Create a new poll');
  });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });
});

describe('POST /polls', () => {
  it('validates missing question', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/polls',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'question=&options=A&options=B',
    });
    expect(res.statusCode).toBe(400);
  });

  it('validates fewer than 2 options', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/polls',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'question=Test&options=Only+one',
    });
    expect(res.statusCode).toBe(400);
  });

  it('redirects to /?poll=<id> on success', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/polls',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'question=Best+fruit%3F&options=Apple&options=Banana',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/?poll=42');
  });
});

describe('POST /polls/:id/vote', () => {
  it('redirects back after voting', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/polls/1/vote',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'optionId=2',
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/?poll=1');
  });

  it('returns 400 when optionId missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/polls/1/vote',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: '',
    });
    expect(res.statusCode).toBe(400);
  });
});
