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

export function generateSlotsInWindows({
  windows, tz, slotMinutes, bufferMinutes, minNoticeMinutes
}) {
  const now = DateTime.now().setZone(tz);
  const minStart = now.plus({ minutes: minNoticeMinutes });

  const slots = [];
  for (const win of windows) {
    let t = win.start.startOf('minute');
    while (t.plus({ minutes: slotMinutes }) <= win.end) {
      const start = t;
      const end = t.plus({ minutes: slotMinutes });

      if (start >= minStart) {
        slots.push({
          start,
          end,
          blockStart: start.minus({ minutes: bufferMinutes }),
          blockEnd: end.plus({ minutes: bufferMinutes })
        });
      }
      t = t.plus({ minutes: slotMinutes });
    }
  }
  return slots;
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