/**
 * Markit Mike Agency: calendar helper for the michael@markitmike.com Google Calendar.
 *
 * The automations worker calls this to:
 *   busy     read busy times so suggested times never clash
 *   hold     put a private "HOLD" block on the calendar (no guests, nobody is emailed)
 *   confirm  turn a hold (or a new time) into the real meeting: title, Google Meet, invite to the client
 *   release  remove holds that were not picked
 *
 * Setup (one time, about 5 minutes):
 *   1. Signed in as michael@markitmike.com, open script.google.com and create a new project.
 *   2. Paste this whole file in place of the starter code.
 *   3. Left sidebar: Services (+), add "Google Calendar API", click Add.
 *   4. Choose the function "setup" in the toolbar and click Run. Approve the permissions.
 *      The log shows a secret. Copy it.
 *   5. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone.
 *      Deploy, then copy the Web app URL.
 *   6. In Cloudflare, worker mma-automations > Settings > Variables and secrets, add two secrets:
 *        GCAL_URL     the Web app URL
 *        GCAL_SECRET  the secret from step 4
 *
 * Nothing here can be used without the secret, and the secret never leaves your Google and Cloudflare accounts.
 */

const CAL = 'primary';

function setup() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('MMA_SECRET');
  if (!s) {
    s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('MMA_SECRET', s);
  }
  Logger.log('Your secret (paste into Cloudflare as GCAL_SECRET): ' + s);
  Logger.log('Calendar time zone: ' + CalendarApp.getDefaultCalendar().getTimeZone());
}

function doGet() {
  return out({ ok: true, service: 'Markit Mike Agency calendar helper' });
}

function doPost(e) {
  let b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out({ error: 'bad json' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('MMA_SECRET');
  if (!secret || b.secret !== secret) return out({ error: 'unauthorized' });
  const fn = ACTIONS[b.action];
  if (!fn) return out({ error: 'unknown action' });
  try { return out(fn(b)); } catch (err) { return out({ error: String(err && err.message || err) }); }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

const ACTIONS = {
  ping: function () {
    return { ok: true, tz: CalendarApp.getDefaultCalendar().getTimeZone() };
  },

  busy: function (b) {
    const r = Calendar.Freebusy.query({ timeMin: b.from, timeMax: b.to, items: [{ id: CAL }] });
    const cal = r.calendars && (r.calendars[CAL] || r.calendars[Object.keys(r.calendars)[0]]);
    return { busy: (cal && cal.busy) || [] };
  },

  hold: function (b) {
    const ev = Calendar.Events.insert({
      summary: String(b.title || 'HOLD').slice(0, 200),
      description: String(b.description || '').slice(0, 4000),
      start: { dateTime: b.start },
      end: { dateTime: b.end },
      transparency: 'opaque',
      visibility: 'private',
      colorId: '5',
      reminders: { useDefault: false, overrides: [] },
    }, CAL, { sendUpdates: 'none' });
    return { id: ev.id };
  },

  // b.id is optional: with it the hold becomes the meeting, without it a new event is created
  confirm: function (b) {
    const body = {
      summary: String(b.title || 'Meeting').slice(0, 200),
      description: String(b.description || '').slice(0, 8000),
      start: { dateTime: b.start },
      end: { dateTime: b.end },
      attendees: [{ email: b.email, displayName: b.name || '' }],
      transparency: 'opaque',
      visibility: 'default',
      colorId: '3',
      reminders: { useDefault: true },
      guestsCanModify: false,
      guestsCanInviteOthers: true,
      conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    };
    const opts = { conferenceDataVersion: 1, sendUpdates: 'all' };
    let ev;
    if (b.id) {
      try { ev = Calendar.Events.patch(body, CAL, b.id, opts); } catch (err) { ev = null; }
    }
    if (!ev) ev = Calendar.Events.insert(body, CAL, opts);
    return { id: ev.id, meet: ev.hangoutLink || '', link: ev.htmlLink || '' };
  },

  release: function (b) {
    (b.ids || []).forEach(function (id) {
      try { Calendar.Events.remove(CAL, id, { sendUpdates: 'none' }); } catch (err) {}
    });
    return { ok: true };
  },
};
