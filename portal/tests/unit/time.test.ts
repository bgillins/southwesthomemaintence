// ------- Las Vegas time -------
// Servers run on UTC. If these conversions are wrong, a 9:00 AM visit shows up
// at 1:00 AM or on the wrong day.
import { describe, expect, it } from 'vitest';
import { addDays, dayBounds, formatDay, formatTime, fromLocalInput, localDate, toLocalInput } from '@/lib/time';

describe('typing a Las Vegas time into a form', () => {
  it('winter (standard time, UTC-8)', () => {
    expect(fromLocalInput('2026-12-15T09:00').toISOString()).toBe('2026-12-15T17:00:00.000Z');
  });

  it('summer (daylight time, UTC-7)', () => {
    expect(fromLocalInput('2026-07-15T09:00').toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });

  it('late evening lands on the next UTC day but the same Las Vegas day', () => {
    const instant = fromLocalInput('2026-07-15T22:30');
    expect(instant.toISOString()).toBe('2026-07-16T05:30:00.000Z');
    expect(localDate(instant)).toBe('2026-07-15');
  });

  it('the day the clocks go forward (March 8, 2026)', () => {
    expect(fromLocalInput('2026-03-08T01:30').toISOString()).toBe('2026-03-08T09:30:00.000Z');
    expect(fromLocalInput('2026-03-08T03:30').toISOString()).toBe('2026-03-08T10:30:00.000Z');
  });

  it('the day the clocks go back (November 1, 2026)', () => {
    expect(fromLocalInput('2026-11-01T09:00').toISOString()).toBe('2026-11-01T17:00:00.000Z');
  });

  it('round-trips: what is typed is what is shown, all year', () => {
    for (const value of ['2026-01-01T00:00', '2026-03-08T08:15', '2026-06-30T23:59', '2026-11-01T12:00', '2027-02-28T07:45']) {
      expect(toLocalInput(fromLocalInput(value))).toBe(value);
    }
  });
});

describe('showing times', () => {
  const instant = new Date('2026-07-16T05:30:00.000Z'); // 10:30 PM on the 15th in Las Vegas

  it('uses Las Vegas time, not the server clock', () => {
    expect(formatTime(instant)).toBe('10:30 PM');
    expect(formatDay(instant)).toBe('Wed, Jul 15');
    expect(localDate(instant)).toBe('2026-07-15');
  });
});

describe('a calendar day', () => {
  it('is 24 hours normally', () => {
    const { start, end } = dayBounds('2026-07-15');
    expect(start.toISOString()).toBe('2026-07-15T07:00:00.000Z');
    expect((end.getTime() - start.getTime()) / 3600000).toBe(24);
  });

  it('is 23 hours when clocks go forward and 25 when they go back', () => {
    const spring = dayBounds('2026-03-08');
    const autumn = dayBounds('2026-11-01');
    expect((spring.end.getTime() - spring.start.getTime()) / 3600000).toBe(23);
    expect((autumn.end.getTime() - autumn.start.getTime()) / 3600000).toBe(25);
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
