import { DateTime } from 'luxon';
import { getCalendar } from '../lib/google.js';
import { clampToWindow, intervalsFromEvents, generateSlotsInWindows, filterBusy } from '../lib/slots.js';

const {
  BUSINESS_TZ='Europe/Brussels',
  AVAIL_CAL_ID,
  BOOKINGS_CAL_ID='primary',
  SLOT_MINUTES='60',
  BUFFER_MINUTES='10',
  MIN_NOTICE_MINUTES='720',
  MAX_DAYS_AHEAD='8'
} = process.env;

export default async function handler(req, res) {
  try {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const rawDate = searchParams.get('date');           // YYYY-MM-DD (business TZ)
    const userTz  = searchParams.get('tz') || BUSINESS_TZ; // visitor's TZ for labels
    const age     = searchParams.get('age') || '';      // e.g., "6-7" (for future use)

    if (!rawDate) return res.status(400).json({ error: 'Missing date' });

    const dateISO = clampToWindow(rawDate, BUSINESS_TZ, Number(MAX_DAYS_AHEAD));

    const cal = getCalendar();
    const dayStart = DateTime.fromISO(dateISO, { zone: BUSINESS_TZ }).startOf('day');
    const dayEnd   = dayStart.endOf('day');

    // 1) Fetch "open windows" from availability calendar
    const avail = await cal.events.list({
      calendarId: AVAIL_CAL_ID,
      timeMin: dayStart.toUTC().toISO(),
      timeMax: dayEnd.toUTC().toISO(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    const windows = intervalsFromEvents(avail.data.items || [], BUSINESS_TZ);
    if (!windows.length) return res.json({ slots: [], date: dateISO });

    // 2) Generate candidate slots within those windows
    const candidates = generateSlotsInWindows({
      windows,
      tz: BUSINESS_TZ,
      slotMinutes: Number(SLOT_MINUTES),
      bufferMinutes: Number(BUFFER_MINUTES),
      minNoticeMinutes: Number(MIN_NOTICE_MINUTES)
    });

    // 3) Subtract teacher busy from Bookings calendar (hides taken)
    const fb = await cal.freebusy.query({
      requestBody: {
        timeMin: dayStart.toUTC().toISO(),
        timeMax: dayEnd.toUTC().toISO(),
        items: [{ id: BOOKINGS_CAL_ID }]
      }
    });
    const busy = fb.data.calendars[BOOKINGS_CAL_ID].busy || [];
    let open = filterBusy(candidates, busy, BUSINESS_TZ);

    // (Cool-to-have OFF for now) — if you later want "allow if same age group",
    // you would list events in the slot and check extendedProperties for age match.

    const slots = open.map(s => {
      const isoStart = s.start.setZone(BUSINESS_TZ).toISO();
      const isoEnd   = s.end.setZone(BUSINESS_TZ).toISO();
      // label for visitor in their timezone
      const label = s.start.setZone(userTz).toFormat('HH:mm');
      return { isoStart, isoEnd, label };
    });

    res.json({ slots, date: dateISO });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}