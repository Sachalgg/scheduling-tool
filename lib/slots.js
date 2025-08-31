import { DateTime, Interval } from 'luxon';

export function clampToWindow(dateISO, tz, maxDaysAhead=8) {
  const today = DateTime.now().setZone(tz).startOf('day');
  const target = DateTime.fromISO(dateISO, { zone: tz }).startOf('day');
  const max = today.plus({ days: maxDaysAhead });
  if (target < today) return today.toISODate();
  if (target > max) return max.toISODate();
  return target.toISODate();
}

export function intervalsFromEvents(events, tz) {
  // Each event defines an "open window"
  return events.map(ev => {
    const s = ev.start.dateTime || (ev.start.date + 'T00:00:00');
    const e = ev.end.dateTime   || (ev.end.date   + 'T23:59:59');
    return Interval.fromDateTimes(DateTime.fromISO(s, { zone: tz }), DateTime.fromISO(e, { zone: tz }));
  });
}

export function intervalsFromEvents(events, tz) {
  const out = [];
  for (const ev of (events || [])) {
    let start, end;

    if (ev.start?.dateTime) {
      // Timed event
      start = DateTime.fromISO(ev.start.dateTime).setZone(tz);
      end   = DateTime.fromISO(ev.end?.dateTime ?? ev.start.dateTime).setZone(tz);
    } else if (ev.start?.date) {
      // All-day: 00:00 → 00:00 next day (DST-safe)
      const day = DateTime.fromISO(ev.start.date, { zone: tz }).startOf('day');
      start = day;
      end   = day.plus({ days: 1 });
    } else {
      continue; // skip malformed event
    }

    const iv = Interval.fromDateTimes(start, end);
    if (iv.isValid && iv.length('minutes') > 0) out.push(iv);
  }

  // Optional but recommended: merge overlaps before returning
  return mergeIntervals ? mergeIntervals(out) : out;
}


export function filterBusy(slots, busy, tz) {
  const busyIntervals = busy.map(({ start, end }) =>
    Interval.fromDateTimes(DateTime.fromISO(start, { zone: tz }), DateTime.fromISO(end, { zone: tz }))
  );
  return slots.filter(s => {
    const interval = Interval.fromDateTimes(s.blockStart, s.blockEnd);
    return !busyIntervals.some(b => b.overlaps(interval));
  });
}