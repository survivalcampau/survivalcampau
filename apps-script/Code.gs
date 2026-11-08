/**
 * Waitlist sign-ups → this Google Sheet.
 *
 * Set-up (full steps in README.md, "Connect the Google Sheet"):
 *   1. In the Sheet: Extensions → Apps Script. Paste this file over the sample code and save.
 *   2. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *   3. Copy the web app URL (ends in /exec) into APPS_SCRIPT_URL in config.js.
 * After changing this script: Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.
 * That keeps the same URL.
 */

const SHEET_NAME = 'Waitlist';   // tab to write to (created if it doesn't exist)
const MIN_SECONDS_ON_PAGE = 3;   // faster than this is almost certainly a bot

// Columns, matched by the header text in row 1 (case and spaces don't matter, so "First name"
// works for first_name). Reorder them or add your own, e.g. "notes". Any of these that are
// missing get added to the end of row 1 automatically.
const HEADERS = [
  'timestamp', 'email', 'first_name', 'skills', 'field_days', 'postcode',
  'utm_source', 'utm_medium', 'utm_campaign', 'referrer', 'seconds_on_page',
];

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/; // same check as script.js

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // Spam trap: people never see this field. Reply "ok" so bots learn nothing.
    if (p.website) return json_({ ok: true });

    const email = clean_(p.email, 1000).toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) return json_({ ok: false, error: 'invalid_email' });

    const seconds = Number(p.seconds_on_page);
    if (!(seconds >= MIN_SECONDS_ON_PAGE)) return json_({ ok: false, error: 'too_fast' });

    const skills = ((e.parameters && e.parameters.skills) || [])
      .join(',')
      .split(',')
      .map(s => clean_(s, 40))
      .filter(s => s)
      .join(', ');
    const postcode = clean_(p.postcode, 10);

    appendRow_({
      timestamp: new Date(),
      email: email,
      first_name: clean_(p.first_name, 60),
      skills: clean_(skills, 300),
      field_days: clean_(p.field_days, 10),
      postcode: /^\d{4}$/.test(postcode) ? postcode : '',
      utm_source: clean_(p.utm_source, 100),
      utm_medium: clean_(p.utm_medium, 100),
      utm_campaign: clean_(p.utm_campaign, 100),
      referrer: clean_(p.referrer, 300),
      seconds_on_page: Math.round(seconds),
    });
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

// Opening the web app URL in a browser shows this: a quick way to check the deployment works.
function doGet() {
  return json_({ ok: true, message: 'Waitlist endpoint is running. Sign-ups arrive by POST from the site.' });
}

// Run this from the editor (pick it in the function menu, then Run) to check the script can
// write to the Sheet. It adds a row for test@example.com; delete that row afterwards.
function testDoPost() {
  const res = doPost({
    parameter: {
      email: 'test@example.com', first_name: 'Test', field_days: 'Maybe', postcode: '2000',
      seconds_on_page: '12', utm_source: 'editor-test',
    },
    parameters: { skills: ['Fire, Water'] },
  });
  console.log(res.getContent());
}

function appendRow_(record) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // one write at a time, so simultaneous sign-ups can't collide
  try {
    const sheet = getSheet_();
    const keys = ensureHeaders_(sheet);
    sheet.appendRow(keys.map(key => (key in record ? toCell_(record[key]) : '')));
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

// Returns the column keys in sheet order, adding any missing headers to row 1 first
function ensureHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  const keys = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(headerKey_) : [];
  const missing = HEADERS.filter(h => keys.indexOf(h) === -1);
  if (missing.length) {
    sheet.getRange(1, keys.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return keys.concat(missing);
}

function headerKey_(header) {
  return String(header).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

// Trims, collapses whitespace, strips control characters and caps the length
function clean_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// Keeps text as text: stops it running as a formula (starts with = + - @) and stops number-like
// values changing (postcode 0800 would otherwise become 800).
function toCell_(value) {
  if (typeof value !== 'string' || value === '') return value;
  return /^[=+\-@]/.test(value) || /^[\d\s.,:\/-]+$/.test(value) ? "'" + value : value;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
