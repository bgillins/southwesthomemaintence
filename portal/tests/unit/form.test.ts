// ------- Reading form fields -------
import { describe, expect, it } from 'vitest';
import { int, isUuid, text } from '@/lib/form';

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
};

describe('text', () => {
  it('trims, and treats blank as nothing', () => {
    expect(text(form({ a: '  hello ' }), 'a')).toBe('hello');
    expect(text(form({ a: '   ' }), 'a')).toBeNull();
    expect(text(form({}), 'a')).toBeNull();
  });
});

describe('int', () => {
  it('reads whole numbers and rejects junk', () => {
    expect(int(form({ a: '2015' }), 'a')).toBe(2015);
    expect(int(form({ a: 'abc' }), 'a')).toBeNull();
    expect(int(form({ a: '' }), 'a')).toBeNull();
  });
});

describe('isUuid', () => {
  it('accepts real ids only', () => {
    expect(isUuid('3f2b8c1e-9d4a-4b6f-8e2a-1c3d5e7f9a0b')).toBe(true);
    for (const bad of ['', 'abc', '3f2b8c1e-9d4a-4b6f-8e2a-1c3d5e7f9a0b; drop table', "' or 1=1", null, undefined, 42]) expect(isUuid(bad)).toBe(false);
  });
});
