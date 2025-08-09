import { getCalendar } from '../lib/google.js';

const {
  BUSINESS_TZ='Europe/Brussels',
  BOOKINGS_CAL_ID='primary'
} = process.env;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { isoStart, isoEnd, name, email, phone, age } = req.body || {};
    if (!isoStart || !isoEnd || !name || !email) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const cal = getCalendar();

    const resource = {
      summary: `Cours d'essai (${age || 'NA'}) - ${name}`,
      description: `Réservé via site.\nTéléphone: ${phone || '—'}\nAge group: ${age || 'NA'}`,
      start: { dateTime: isoStart, timeZone: BUSINESS_TZ },
      end:   { dateTime: isoEnd,   timeZone: BUSINESS_TZ },
      attendees: [{ email, displayName: name }],
      reminders: { useDefault: true },
      extendedProperties: {
        private: { ageGroup: age || '' }
      }
    };

    // Creates the event; if slot was just taken, Google returns a 409-like error
    const resp = await cal.events.insert({
      calendarId: BOOKINGS_CAL_ID,
      requestBody: resource,
      sendUpdates: 'all'
    });

    res.json({ ok: true, eventId: resp.data.id });
  } catch (e) {
    res.status(409).json({ ok: false, error: e.message });
  }
}