import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expected = [
  'Recurring Maintenance',
  'One Time Cut',
  'Mow',
  'Weed Eat',
  'Edge',
  'Blow',
  'Property Clean Up',
  'Hedging',
  'Initial Property Knock Down',
  'Debris Removal',
  'Standard Lawn Care',
  'Corner Lot Care',
  'Landscape Cleanup'
];

const prod = JSON.parse(await readFile(new URL('../server/data/production-seed.json', import.meta.url), 'utf8'));
const train = JSON.parse(await readFile(new URL('../server/data/training-seed.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../website/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app/app.js', import.meta.url), 'utf8');
const shell = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const sitejs = await readFile(new URL('../website/assets/site.js', import.meta.url), 'utf8');
const server = await readFile(new URL('../server/server.mjs', import.meta.url), 'utf8');

assert.deepEqual(prod.services.map(s=>s.name), expected, 'production service catalog must match approved list exactly');
assert.deepEqual(train.services.map(s=>s.name), expected, 'training service catalog must match production exactly');
for (const name of expected) assert.ok(html.includes(`<option>${name}</option>`), `website estimate missing service: ${name}`);
assert.ok(app.includes("data.services.map(s=>s.name)"), 'app service dropdowns must use shared service catalog');
for (const field of ['front1','front2','front3','front4','back1','back2','back3','back4']) assert.ok(html.includes(`name=\"${field}\"`), `estimate form missing photo slot ${field}`);
assert.ok(sitejs.includes("for(const yard of ['front','back'])for(let i=1;i<=4;i++)"), 'website must collect four front and four back photos');
assert.ok(server.includes('photos.slice(0,8)'), 'server must cap estimate photos at eight');
const combined = [html,app,shell,sitejs,server,JSON.stringify(prod),JSON.stringify(train)].join('\n').toLowerCase();
const excludedPressure='pressure'+' wash';assert.ok(!combined.includes(excludedPressure), 'excluded pressure-service wording must not appear in service/application content');
const oldProduct='business'+' in '+'a box';assert.ok(!combined.includes(oldProduct), 'old product wording must be removed');
assert.ok(shell.includes('Combo Web and App'), 'app shell must display Combo Web and App');
assert.ok(shell.includes('Combo Web and App · Tenant #1'), 'lower-left app footer must display Combo Web and App');
assert.equal(prod.customers.length,0,'production seed must contain zero customers');
assert.ok(!(prod.users||[]).some(u=>u.passwordHash),'production seed must not contain a pre-created password');
console.log('release-v083: PASS');
