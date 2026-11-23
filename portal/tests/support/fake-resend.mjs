// ------- Stand-in for Resend during tests -------
// The app sends email by POSTing to Resend. In tests RESEND_API_URL points here
// instead, so the app runs its real email code but nothing leaves the machine.
// Tests then ask this server what was "sent" and check it.
//
//   POST   /emails          what the app calls (same shape as Resend's API)
//   GET    /_outbox?to=...  emails received, optionally for one address
//   DELETE /_outbox         forget everything
//
// Any recipient containing "bounce" is rejected, to test the failure path.
import { createServer } from 'node:http';
import testEnv from './env.cjs';

const { PORTS } = testEnv;

let outbox = [];

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORTS.email}`);
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  if (request.method === 'POST' && url.pathname === '/emails') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const email = JSON.parse(raw);
    if (email.to.some((address) => address.includes('bounce'))) {
      return send(422, { name: 'validation_error', message: 'Recipient address was rejected (test bounce).' });
    }
    const stored = { id: `test-${outbox.length + 1}`, at: Date.now(), authorization: request.headers.authorization ?? null, ...email };
    outbox.push(stored);
    return send(200, { id: stored.id });
  }

  if (request.method === 'GET' && url.pathname === '/_outbox') {
    const to = url.searchParams.get('to');
    return send(200, to ? outbox.filter((email) => email.to.includes(to)) : outbox);
  }

  if (request.method === 'DELETE' && url.pathname === '/_outbox') {
    outbox = [];
    return send(200, { ok: true });
  }

  if (url.pathname === '/health') return send(200, { ok: true });
  send(404, { message: 'not found' });
});

server.listen(PORTS.email, () => console.log(`fake Resend listening on ${PORTS.email}`));
