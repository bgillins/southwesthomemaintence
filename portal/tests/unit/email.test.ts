// ------- Emails: wording, safety and the request sent to Resend -------
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportEmail, sendEmail, signInEmail } from '@/lib/email';

const report = (over = {}) =>
  reportEmail({
    customerName: 'Pat Rivera',
    address: '12 Desert Rose Ct',
    visitDay: 'Monday, November 23, 2026',
    techName: 'Sam Ortiz',
    summary: 'All good today.',
    doneCount: 27,
    attentionNames: [],
    link: 'https://portal.example/r/abc',
    ...over,
  });

describe('sign-in email', () => {
  const email = signInEmail({ code: '12345678', link: 'https://portal.example/auth/confirm?token_hash=xyz' });

  it('carries the code and the one-tap link in both the text and HTML versions', () => {
    for (const body of [email.text, email.html]) {
      expect(body).toContain('12345678');
      expect(body).toContain('https://portal.example/auth/confirm?token_hash=xyz');
    }
    expect(email.subject).toContain('12345678');
  });
});

describe('visit report email', () => {
  it('greets by first name and links to the report', () => {
    const email = report();
    expect(email.text).toContain('Hi Pat,');
    expect(email.text).toContain('https://portal.example/r/abc');
    expect(email.html).toContain('href="https://portal.example/r/abc"');
    expect(email.text).toContain('27 checklist items completed');
  });

  it('says so plainly when nothing needs attention', () => {
    expect(report().text).toContain('Nothing needs your attention this time.');
  });

  it('lists what needs a look, with the right count', () => {
    expect(report({ attentionNames: ['Toilets'] }).text).toContain('one thing');
    const two = report({ attentionNames: ['Toilets', 'Roof'] });
    expect(two.text).toContain('2 things');
    expect(two.text).toContain('- Toilets');
    expect(two.html).toContain('<li>Roof</li>');
  });

  it('leaves out the note block when the tech wrote no note', () => {
    expect(report({ summary: null }).html).not.toContain('border-left:3px');
  });

  it('cannot be used to inject HTML through a name, address or note', () => {
    const email = report({
      customerName: '<script>alert(1)</script> Rivera',
      address: '1 "Main" <b>St</b>',
      summary: '<img src=x onerror=alert(1)>',
      attentionNames: ['<a href="evil">x</a>'],
    });
    expect(email.html).not.toContain('<script>');
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).not.toContain('<b>St</b>');
    expect(email.html).not.toContain('<a href="evil">');
    expect(email.html).toContain('&lt;script&gt;');
  });
});

describe('sending through Resend', () => {
  const message = { to: ['a@example.com'], subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('posts to Resend with the key, the sender and the reply-to address', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'SHM <shm@example.com>');
    vi.stubEnv('EMAIL_REPLY_TO', 'owner@example.com');
    vi.stubEnv('RESEND_API_URL', '');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'abc' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendEmail(message);
    expect(result).toEqual({ ok: true, id: 'abc' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body as string)).toMatchObject({ from: 'SHM <shm@example.com>', to: ['a@example.com'], subject: 'Hi', reply_to: 'owner@example.com' });
  });

  it('reports Resend’s own error message when a send is rejected', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'SHM <shm@example.com>');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Domain not verified' }), { status: 403 })));
    expect(await sendEmail(message)).toEqual({ ok: false, error: 'Domain not verified' });
  });

  it('reports a network failure instead of crashing', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'SHM <shm@example.com>');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('socket hang up'); }));
    expect(await sendEmail(message)).toEqual({ ok: false, error: 'socket hang up' });
  });

  it('in production, refuses (rather than pretending) when email is not set up', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await sendEmail(message);
    expect(result.ok).toBe(false);
  });
});
