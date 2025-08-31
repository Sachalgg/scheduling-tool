-import { getCalendar } from '../lib/google.js';
+import { DateTime } from 'luxon';
+import { getCalendar } from '../lib/google.js';

 const {
   BUSINESS_TZ='Europe/Brussels',
   BOOKINGS_CAL_ID='primary'
 } = process.env;

 export default async function handler(req, res) {
-  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
+  res.setHeader('Access-Control-Allow-Origin', '*');
+  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
+  res.setHeader('Access-Control-Allow-Headers', 'content-type');
+  if (req.method === 'OPTIONS') return res.status(204).end();
+  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

   try {
-    const { isoStart, isoEnd, name, email, phone, age } = req.body || {};
+    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
+    const { isoStart, isoEnd, name, email, phone, age } = body;
     if (!isoStart || !isoEnd || !name || !email) {
       return res.status(400).json({ error: 'Missing fields' });
     }

     const cal = getCalendar();

+    // Anti double-booking : re-check FreeBusy juste avant insert
+    const fb = await cal.freebusy.query({
+      requestBody: {
+        timeMin: DateTime.fromISO(isoStart).toUTC().toISO(),
+        timeMax: DateTime.fromISO(isoEnd).toUTC().toISO(),
+        items: [{ id: BOOKINGS_CAL_ID }],
+        timeZone: BUSINESS_TZ
+      }
+    });
+    const already = fb.data.calendars?.[BOOKINGS_CAL_ID]?.busy || [];
+    if (already.length) {
+      return res.status(409).json({ ok:false, error: 'Slot already taken' });
+    }
+
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
-    res.status(409).json({ ok: false, error: e.message });
+    // Si Google a déjà pris le créneau entre-temps
+    const code = /(409|concurrent|conflict)/i.test(e.message) ? 409 : 500;
+    res.status(code).json({ ok: false, error: e.message });
   }
 }