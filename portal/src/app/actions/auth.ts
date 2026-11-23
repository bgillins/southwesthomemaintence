'use server';

// ------- Sign in with an emailed code -------
// Why a code and not just a link: a tech who added the portal to their home
// screen gets a separate browser from Mail, so a tapped link signs in the wrong
// place. A typed code works everywhere. The email carries both.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl, ownerEmails } from '@/lib/env';
import { sendEmail, signInEmail } from '@/lib/email';

export interface SignInState {
  step: 'email' | 'code';
  email?: string;
  error?: string;
}

const MAX_CODES_PER_15_MIN = 4;

export async function requestCode(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { step: 'email', error: 'Enter your work email address.' };

  const admin = createAdminClient();

  // Only people on the team get a code. Everyone else sees the same screen, so
  // the form cannot be used to find out who works here.
  const { data: staff } = await admin.from('staff').select('id').eq('email', email).eq('active', true).maybeSingle();
  const allowed = Boolean(staff) || ownerEmails().includes(email);

  if (allowed) {
    // Throttle, so nobody can flood a tech's inbox by hammering the form.
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('message_log')
      .select('id', { count: 'exact', head: true })
      .eq('template', 'sign_in')
      .eq('recipient', email)
      .gte('created_at', since);

    if ((count ?? 0) < MAX_CODES_PER_15_MIN) {
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      if (error || !data.properties) {
        console.error('sign-in: could not create a code', error?.message);
        return { step: 'email', error: 'Something went wrong. Try again in a minute.' };
      }
      const link = `${appUrl()}/auth/confirm?token_hash=${data.properties.hashed_token}`;
      const result = await sendEmail({ to: [email], ...signInEmail({ code: data.properties.email_otp, link }) });
      await admin.from('message_log').insert({
        template: 'sign_in',
        recipient: email,
        status: result.ok ? 'sent' : 'failed',
        provider_id: result.id ?? null,
        error: result.error ?? null,
      });
      if (!result.ok) return { step: 'email', error: 'We could not send the email. Ask the office to check the email setup.' };
    }
  }

  return { step: 'code', email };
}

export async function verifyCode(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const token = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (!token) return { step: 'code', email, error: 'Enter the code from the email.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) return { step: 'code', email, error: 'That code did not work. Check it, or ask for a new one.' };

  await ensureStaffRow(data.user.id, email);
  redirect('/');
}

// One-tap link from the email. Verified on a button press (not on page load) so
// email scanners that open links cannot use the link up before the person does.
export async function verifyLink(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
  if (error || !data.user?.email) redirect('/login?expired=1');

  await ensureStaffRow(data.user.id, data.user.email.toLowerCase());
  redirect('/');
}

// The owners named in PORTAL_OWNER_EMAILS get their staff record on first sign-in.
// That is how the very first person gets in; they add everyone else on the Team page.
async function ensureStaffRow(userId: string, email: string) {
  if (!ownerEmails().includes(email)) return;
  const admin = createAdminClient();
  const { data: existing } = await admin.from('staff').select('id').eq('id', userId).maybeSingle();
  if (existing) return;
  const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  await admin.from('staff').insert({ id: userId, email, full_name: name, role: 'owner' });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
