'use client';

import { useFormStatus } from 'react-dom';

// A submit button that greys out while its form is saving, so nobody double-taps.
export function SubmitButton({ children, className = 'btn btn-primary', pendingLabel = 'Saving…' }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
