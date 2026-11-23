// ------- Email through Resend -------
// Two emails: the sign-in code for staff, and the visit report for customers.
// A plain fetch keeps this dependency-free; Resend's API is one POST.
import 'server-only';

interface Email {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(email: Email): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  // No key yet (local development): print the email so the flow can still be tested.
  if (!key || !from) {
    console.log(`\n------- EMAIL NOT SENT (set RESEND_API_KEY and EMAIL_FROM) -------\nTo: ${email.to.join(', ')}\nSubject: ${email.subject}\n\n${email.text}\n-------\n`);
    if (process.env.NODE_ENV === 'production') return { ok: false, error: 'Email is not set up yet (RESEND_API_KEY / EMAIL_FROM).' };
    return { ok: true, id: 'printed-to-console' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: email.to, subject: email.subject, html: email.html, text: email.text, reply_to: email.replyTo }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) return { ok: false, error: body.message ?? `Resend answered ${response.status}` };
    return { ok: true, id: body.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not reach Resend' };
  }
}

// ------- Shared look -------
const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f7f3e8;font-family:Helvetica,Arial,sans-serif;color:#06243a">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <p style="margin:0 0 24px;font-size:15px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#587b0b">Southwest Home Maintenance</p>
  <div style="background:#ffffff;border:1px solid #e3dccb;border-radius:16px;padding:28px">
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:1.2">${escape(title)}</h1>
    ${body}
  </div>
</div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0 0"><a href="${href}" style="display:inline-block;background:#eca319;color:#06243a;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:999px">${escape(label)}</a></p>`;

// ------- Sign-in email -------
export function signInEmail(opts: { code: string; link: string }) {
  return {
    subject: `${opts.code} is your sign-in code`,
    text: `Your Southwest Home Maintenance sign-in code is ${opts.code}\n\nOr open this link on the same phone: ${opts.link}\n\nThe code works once and expires in an hour. If you did not ask for it, ignore this email.`,
    html: layout(
      'Your sign-in code',
      `<p style="margin:0 0 8px;font-size:16px;line-height:1.5">Type this code into the portal:</p>
       <p style="margin:0;font-size:34px;font-weight:700;letter-spacing:.12em">${escape(opts.code)}</p>
       ${button(opts.link, 'Or sign in with one tap')}
       <p style="margin:24px 0 0;font-size:13px;color:#3f5566">The code works once and expires in an hour. If you did not ask for it, ignore this email.</p>`,
    ),
  };
}

// ------- Visit report email -------
export function reportEmail(opts: {
  customerName: string;
  address: string;
  visitDay: string;
  techName: string;
  summary: string | null;
  doneCount: number;
  attentionNames: string[];
  link: string;
}) {
  const first = opts.customerName.split(' ')[0];
  const attention = opts.attentionNames.length
    ? `We found ${opts.attentionNames.length === 1 ? 'one thing' : `${opts.attentionNames.length} things`} worth a look:\n${opts.attentionNames.map((name) => `  - ${name}`).join('\n')}`
    : 'Nothing needs your attention this time.';
  const attentionHtml = opts.attentionNames.length
    ? `<p style="margin:16px 0 6px;font-size:16px;font-weight:700">Worth a look</p><ul style="margin:0;padding-left:20px;font-size:16px;line-height:1.6">${opts.attentionNames.map((name) => `<li>${escape(name)}</li>`).join('')}</ul>`
    : `<p style="margin:16px 0 0;font-size:16px;line-height:1.5;background:#eaf1d8;color:#33490a;padding:12px 14px;border-radius:10px">Nothing needs your attention this time.</p>`;

  return {
    subject: `Your home report for ${opts.visitDay}`,
    text: `Hi ${first},\n\n${opts.techName} finished today's visit at ${opts.address}. ${opts.doneCount} checklist items completed.\n\n${opts.summary ? `${opts.summary}\n\n` : ''}${attention}\n\nSee the full report with photos: ${opts.link}\n\nSouthwest Home Maintenance`,
    html: layout(
      `Your home report for ${opts.visitDay}`,
      `<p style="margin:0;font-size:16px;line-height:1.6">Hi ${escape(first)}, ${escape(opts.techName)} finished the visit at ${escape(opts.address)}. <strong>${opts.doneCount} checklist items</strong> completed.</p>
       ${opts.summary ? `<p style="margin:16px 0 0;font-size:16px;line-height:1.6;border-left:3px solid #eca319;padding-left:14px">${escape(opts.summary).replace(/\n/g, '<br>')}</p>` : ''}
       ${attentionHtml}
       ${button(opts.link, 'See the full report and photos')}`,
    ),
  };
}
