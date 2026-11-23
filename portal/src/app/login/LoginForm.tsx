'use client';

import { useActionState } from 'react';
import { requestCode, verifyCode, type SignInState } from '@/app/actions/auth';

// Two steps on one screen: ask for the email, then ask for the code we sent.
export function LoginForm() {
  const [sent, sendAction, sending] = useActionState<SignInState, FormData>(requestCode, { step: 'email' });
  const [checked, checkAction, checking] = useActionState<SignInState, FormData>(verifyCode, { step: 'code' });

  if (sent.step === 'email') {
    return (
      <form action={sendAction} className="mt-4 space-y-4">
        <p className="text-navy-muted">Enter your email and we will send you a sign-in code.</p>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required className="input" defaultValue={sent.email} />
        </div>
        {sent.error ? <p role="alert" className="text-sm font-semibold text-alert">{sent.error}</p> : null}
        <button type="submit" disabled={sending} className="btn btn-primary w-full">{sending ? 'Sending…' : 'Email me a code'}</button>
      </form>
    );
  }

  return (
    <form action={checkAction} className="mt-4 space-y-4">
      <p className="text-navy-muted">
        If <strong className="text-navy">{sent.email}</strong> is on the team, a code is on its way. It can take a minute.
      </p>
      <input type="hidden" name="email" value={sent.email} />
      <div>
        <label htmlFor="code" className="label">Sign-in code</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus className="input text-center text-2xl font-bold tracking-[0.2em]" />
      </div>
      {checked.error ? <p role="alert" className="text-sm font-semibold text-alert">{checked.error}</p> : null}
      <button type="submit" disabled={checking} className="btn btn-primary w-full">{checking ? 'Checking…' : 'Sign in'}</button>
      <a href="/login" className="block text-center text-sm font-semibold text-navy-muted underline">Use a different email or send a new code</a>
    </form>
  );
}
