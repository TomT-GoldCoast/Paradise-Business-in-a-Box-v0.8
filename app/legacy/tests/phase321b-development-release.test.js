const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('development build is clearly labeled with version and backup action', () => {
  assert.match(html, /DEVELOPMENT BUILD/);
  assert.match(html, /v3\.21B/);
  assert.match(html, /exportParadiseBackupV321B/);
});

test('first-use backup reminder is present', () => {
  assert.match(html, /developmentBackupReminder/);
  assert.match(js, /PLC_DEVELOPMENT_REMINDER_KEY_V321B/);
  assert.match(js, /showDevelopmentReminderV321B/);
});

test('ZIP lookup fills city and state silently without redundant text', () => {
  assert.match(js, /ZIP lookup remains silent/);
  assert.doesNotMatch(js, /status\.textContent=`\$\{result\.city\}, \$\{result\.state\}`/);
  assert.match(css, /\.zip-lookup-status\{display:none!important\}/);
});

test('account and record-link verification is included', () => {
  assert.match(js, /function verifyAccountLinkIntegrityV321B/);
  assert.match(js, /account mismatch/);
  assert.match(js, /missing customer link/);
});

test('backup exports all browser storage as JSON', () => {
  assert.match(js, /for\(let index=0;index<localStorage\.length/);
  assert.match(js, /Paradise-Lawn-Care-Backup-/);
  assert.match(js, /application:\"Paradise Lawn Care Operations Suite\"/);
});
