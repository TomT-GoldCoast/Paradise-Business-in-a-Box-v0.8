const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('visible identity uses Account Number and hides internal job id', () => {
  assert.match(html, /<label>Account Number<\/label><input id="invoiceCustomerNumber"/);
  assert.match(html, /<span>Account Number<\/span><strong id="customerNumberDisplay"/);
  assert.match(html, /class="internal-id-field" hidden/);
  assert.doesNotMatch(html, /<span>Customer ID<\/span>/);
});

test('account migration preserves compatibility aliases across records', () => {
  assert.match(js, /function migrateAccountDataV321/);
  assert.match(js, /customer\.accountNumber/);
  assert.match(js, /customer\.customerNumber=customer\.accountNumber/);
  assert.match(js, /q\.accountNumber=acct/);
  assert.match(js, /i\.accountNumber=acct/);
  assert.match(js, /migrateScheduleAccountNumbersV321/);
});

test('customer updates cascade to quotes invoices schedule and communications', () => {
  assert.match(js, /function syncCustomerAcrossRecordsV321/);
  assert.match(js, /q\.customerId!==customerId/);
  assert.match(js, /i\.customerId!==customerId/);
  assert.match(js, /renderCommunicationRecipients\(\)/);
  assert.match(js, /renderSchedule\(\)/);
});

test('duplicate protection checks name phone email business and address', () => {
  assert.match(js, /function customerMatchScoreV321/);
  assert.match(js, /Possible existing account found/);
  assert.match(js, /Open Existing Account/);
  assert.match(js, /Create a separate new account anyway/);
});

test('zip autofill and saved-address prediction are wired across forms', () => {
  assert.match(js, /api\.zippopotam\.us\/us/);
  assert.match(js, /wireZipAutofillV321\(byId\("customerZip"/);
  assert.match(js, /wireZipAutofillV321\(byId\("quoteZip"/);
  assert.match(js, /wireZipAutofillV321\(byId\("invoiceBillingZip"/);
  assert.match(js, /plcSavedAddresses/);
});

test('invoice PDF adds account number', () => {
  assert.match(js, /viewInvoicePdfV321AccountBase/);
  assert.match(js, /<strong>Account Number:<\/strong>/);
});
