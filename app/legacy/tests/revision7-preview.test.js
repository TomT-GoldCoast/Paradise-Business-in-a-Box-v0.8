const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('style.css','utf8');
const js = fs.readFileSync('script.js','utf8');

test('quote defaults to new customer with one optional account selector', () => {
  assert.match(html, /id="quoteCustomerMode"[^>]*value="new"/);
  assert.match(html, /id="quoteNewCustomerMode"/);
  assert.match(html, /id="quoteExistingCustomerMode"/);
  assert.doesNotMatch(html, /class="quote-property-button"/);
});

test('quote includes business client and separated service address fields', () => {
  for (const id of ['quoteBusinessName','quoteClientName','quoteStreet','quoteCity','quoteState','quoteZip']) assert.match(html, new RegExp(`id="${id}"`));
});

test('email shells use one reusable responsive component', () => {
  for (const id of ['customerEmail','quoteEmail','email']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(js, /function resizeAllEmailFieldsV322/);
  assert.match(css, /\.email-input-shell\{width:min\(100%,42ch\)/);
});

test('communication recipient actions use matching icons', () => {
  for (const icon of ['☎','▣','✉','♨']) assert.ok(js.includes(icon));
  assert.match(js, /contact-action-icon/);
  assert.match(css, /communication-recipient-actions \.contact-action-icon/);
});

test('new customer quote can create a linked customer on save', () => {
  assert.match(js, /Created from Quote Builder/);
  assert.match(js, /generateCustomerNumberV36/);
  assert.match(js, /customers\.push\(c\);writeArray\(CUSTOMER_STORAGE_KEY,customers\)/);
});
