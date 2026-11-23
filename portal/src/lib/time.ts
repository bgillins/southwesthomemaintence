// ------- Dates and times -------
// The business runs on Las Vegas time. Servers run on UTC. Every date shown or
// typed in the portal goes through here so "today" means today in Las Vegas.

export const TZ = 'America/Los_Angeles';

// "2026-11-23" for the given moment, in Las Vegas.
export function localDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Turn a form's "2026-11-23T09:00" (meant as Las Vegas time) into a real instant.
// How: guess the instant as if it were UTC, see what Las Vegas clock that gives,
// and shift by the difference. Run twice so daylight-saving edges come out right.
export function fromLocalInput(value: string): Date {
  const wanted = new Date(`${value}:00Z`).getTime();
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const shown = new Date(`${toLocalInput(new Date(guess))}:00Z`).getTime();
    guess += wanted - shown;
  }
  return new Date(guess);
}

// The reverse: an instant as "2026-11-23T09:00" in Las Vegas, for form inputs.
export function toLocalInput(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

// Start and end of a Las Vegas calendar day, as instants.
export function dayBounds(day: string): { start: Date; end: Date } {
  const start = fromLocalInput(`${day}T00:00`);
  const end = fromLocalInput(`${addDays(day, 1)}T00:00`);
  return { start, end };
}

export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function formatDay(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value));
}

export function formatLongDay(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
