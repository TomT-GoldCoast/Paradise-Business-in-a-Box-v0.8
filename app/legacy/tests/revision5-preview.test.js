const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const js = fs.readFileSync('script.js','utf8');
const css = fs.readFileSync('style.css','utf8');

test('owner briefing has four fitting tabs including today',()=>{
  for (const period of ['today','tomorrow','week','month']) assert.match(html,new RegExp(`data-briefing-period="${period}"`));
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});

test('invoice quote and property addresses use separated visible fields',()=>{
  for (const id of ['invoiceBillingCity','invoiceBillingState','invoiceBillingZip','quoteStreet','quoteCity','quoteState','quoteZip']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/property-address-grid/);
  assert.match(js,/composeAddressV321/);
});

test('scheduling presents schedule before navigation and AI preview',()=>{
  assert.ok(html.indexOf('schedule-primary-workspace') < html.indexOf('Navigation &amp; Route Center'));
  assert.ok(html.indexOf('Navigation &amp; Route Center') < html.indexOf('AI Suggested Route &amp; Schedule'));
});

test('user communication templates can be saved and deleted',()=>{
  assert.match(html,/saveCommunicationTemplateV321/);
  assert.match(html,/deleteCommunicationTemplateV321/);
  assert.match(js,/plc_user_communication_templates_v1/);
});

test('weather tab opening reinitializes radar',()=>{
  assert.match(js,/tabId==="weatherTab"/);
  assert.match(js,/initializeWeatherRadarMap/);
  assert.match(js,/invalidateSize/);
});
