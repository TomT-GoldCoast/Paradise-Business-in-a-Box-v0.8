const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const js = fs.readFileSync('script.js','utf8');
const css = fs.readFileSync('style.css','utf8');

test('invoice financial layout stacks tax payment and payment link beside financials',()=>{
  assert.match(html,/invoice-finance-layout/);
  assert.match(html,/id="invoicePaymentLink"/);
  assert.match(css,/grid-template-columns:minmax\(280px,.8fr\) minmax\(360px,1.2fr\)/);
});
test('phone formatting supports ten and eleven digit phone numbers',()=>{
  assert.match(js,/function formatTelephoneV321C/);
  assert.match(js,/digits.length===11&&digits.startsWith\("1"\)/);
});
test('invoice before and after photos are available and included in PDF workflow',()=>{
  assert.match(html,/id="invoiceBeforePhotoInput"/);
  assert.match(html,/id="invoiceAfterPhotoInput"/);
  assert.match(js,/appendInvoicePhotosToPdfV321C/);
  assert.match(js,/Before Photos/);
  assert.match(js,/After Photos/);
});
test('schedule employee choices are BP E1 E2 and E3 without RS',()=>{
  assert.match(js,/\['BP','E1','E2','E3'\]/);
  assert.doesNotMatch(js,/<option value="RS"/);
});
test('schedule selected record presents customer and numeric account number and opens linked record',()=>{
  assert.match(html,/Customer Name/);
  assert.match(js,/numericAccountNumberV321C/);
  assert.match(js,/openActiveScheduleRecordV321C/);
});
test('scheduled job input uses compact empty and prominent populated states',()=>{
  assert.match(css,/\.sched-job\{font-size:\.72rem/);
  assert.match(css,/\.sched-job\.has-job/);
});
