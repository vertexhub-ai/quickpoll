import { getPollWithResults, getLatestPollId } from '../db/queries.js';

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPoll(poll) {
  const optRows = poll.options.map(o => `
      <li style="margin:.4rem 0">
        <form method="POST" action="/polls/${poll.id}/vote" style="display:inline">
          <button type="submit" name="optionId" value="${o.id}"
            style="width:100%;text-align:left;padding:.5rem .8rem;cursor:pointer;background:#f0f4ff;border:1px solid #c0c8e8;border-radius:4px">
            ${escHtml(o.label)}
            <span style="float:right;color:#555">${o.vote_count} vote${o.vote_count !== 1 ? 's' : ''} — ${o.pct}%</span>
          </button>
        </form>
      </li>`).join('');

  return `
    <section>
      <h2 style="margin-bottom:.3rem">${escHtml(poll.question)}</h2>
      <p style="margin:0 0 .8rem;color:#666">${poll.total} total vote${poll.total !== 1 ? 's' : ''}</p>
      <ul style="list-style:none;padding:0;margin:0">${optRows}</ul>
    </section>
    <hr style="margin:2rem 0">`;
}

function renderPage(poll) {
  const pollSection = poll ? renderPoll(poll) : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>QuickPoll</title>
  <style>
    body { font-family: system-ui; max-width: 680px; margin: 4rem auto; padding: 0 1rem; color: #1a1a1a; }
    label { display: block; margin: .4rem 0; }
    input[type=text] { width: 100%; padding: .4rem .6rem; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
    .submit { padding: .5rem 1.2rem; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    .submit:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <h1>QuickPoll</h1>
  ${pollSection}
  <h2>Create a new poll</h2>
  <form method="POST" action="/polls">
    <div style="margin-bottom:.8rem">
      <label>Question
        <input type="text" name="question" required placeholder="What do you want to ask?">
      </label>
    </div>
    <div style="margin-bottom:.8rem">
      <label>Option 1 <input type="text" name="options" required placeholder="First option"></label>
      <label>Option 2 <input type="text" name="options" required placeholder="Second option"></label>
      <label>Option 3 <input type="text" name="options" placeholder="Third option (optional)"></label>
      <label>Option 4 <input type="text" name="options" placeholder="Fourth option (optional)"></label>
      <label>Option 5 <input type="text" name="options" placeholder="Fifth option (optional)"></label>
    </div>
    <button type="submit" class="submit">Create Poll</button>
  </form>
</body>
</html>`;
}

export default async function homeRoutes(fastify) {
  fastify.get('/', async (req, reply) => {
    let poll = null;
    try {
      const rawId = req.query.poll;
      const pollId = rawId ? parseInt(rawId, 10) : await getLatestPollId();
      if (pollId) poll = await getPollWithResults(pollId);
    } catch {
      // DB unavailable — render form-only page
    }
    reply.type('text/html').send(renderPage(poll));
  });
}
