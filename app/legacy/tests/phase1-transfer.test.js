const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('payment methods use unique stable identifiers and explicit rates', () => {
  assert.match(html, /value="cash" data-rate="0">Cash/);
  assert.match(html, /value="business-check" data-rate="0">Business Check/);
  assert.match(html, /value="zelle" data-rate="0">Zelle/);
  assert.match(html, /value="credit-card" data-rate="0\.035">Credit Card \+3\.5%/);
  assert.match(script, /paymentCode: payment\.code/);
  assert.match(script, /setPaymentMethodFromRecord\(invoice\)/);
  assert.match(script, /migrateInvoicePaymentMethodsV320\(\)/);
});

test('preferred contact is cascaded to customer, quote, and invoice records', () => {
  assert.match(script, /function setCustomerPreferredContactEverywhere\(customerId, value, sourceId = ""\)/);
  assert.match(script, /quote\.customerId !== customerId/);
  assert.match(script, /invoice\.customerId !== customerId/);
  assert.match(script, /setCustomerPreferredContactEverywhere\(id,item\.preferredContact,"customerPreferredContact"\)/);
});

test('phone and email checkboxes are present on all three record screens', () => {
  for (const id of ['customer', 'quote', 'invoice']) {
    const prefix = id === 'customer' ? 'customer' : id;
    assert.match(html, new RegExp(`id="${prefix}PhonePreferred"`));
    assert.match(html, new RegExp(`id="${prefix}EmailPreferred"`));
  }
});

test('PDF renders both preferred contact and the selected payment method', () => {
  assert.match(script, /Preferred Contact:<\/strong> \$\{escapeHtml\(invoice\.preferredContact\)\}/);
  assert.match(script, /Payment Method: \$\{escapeHtml\(invoice\.paymentMethod\)\}/);
});

test('action cards do not overwrite preferred contact when marked action-only', () => {
  assert.match(script, /const actionOnly = select\.dataset\.actionOnly === "true"/);
  assert.match(script, /actionOnly\s*\? normalizePreferredContact\(activatedButton\.dataset\.value\)/);
  assert.match(script, /if \(select\.dataset\.actionOnly !== "true"\)/);
});
