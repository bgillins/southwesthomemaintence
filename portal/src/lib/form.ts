// ------- Small helpers for reading form fields -------

// Trimmed text, or null when the field was left empty.
export function text(formData: FormData, name: string): string | null {
  const value = String(formData.get(name) ?? '').trim();
  return value === '' ? null : value;
}

export function int(formData: FormData, name: string): number | null {
  const value = text(formData, name);
  if (value === null) return null;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
