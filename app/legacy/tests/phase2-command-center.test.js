const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const js = fs.readFileSync('script.js','utf8');
const css = fs.readFileSync('style.css','utf8');

test('history tab and all-default quick filters exist',()=>{
  assert.match(html,/data-tab="historyTab"/);
  assert.match(html,/id="historyTab"/);
  assert.match(html,/data-history-range="all" class="active"/);
  assert.match(html,/id="historyDate" type="date"/);
});
test('owners briefing has tomorrow week month tabs',()=>{
  assert.match(html,/data-briefing-period="tomorrow"/);
  assert.match(html,/data-briefing-period="week"/);
  assert.match(html,/data-briefing-period="month"/);
});
test('inventory and maintenance cards are condensed details by default',()=>{
  assert.match(html,/<details class="insight-panel dashboard-card collapsible-dashboard-card condensed-dashboard-card" data-card-id="inventory">/);
  assert.match(html,/<details class="insight-panel dashboard-card collapsible-dashboard-card condensed-dashboard-card" data-card-id="upcoming">/);
  assert.match(html,/id="homeInventoryPreview" class="condensed-card-preview"/);
  assert.match(html,/id="homeMaintenancePreview" class="condensed-card-preview"/);
});
test('activity history is one persistent ledger and tracks resolved priorities',()=>{
  assert.match(js,/paradise_activity_history_v320/);
  assert.match(js,/reconcileActivityTransitionsV320/);
  assert.match(js,/Completed: \$\{item\.title\}/);
});
test('dashboard has semantic red yellow green states and six metric row',()=>{
  assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css,/priority-item\.red/);
  assert.match(css,/priority-item\.yellow/);
  assert.match(css,/priority-item\.green/);
});

test('phase two revision uses balanced half-width cards and home history preview',()=>{
  assert.match(html,/class="insight-panel dashboard-card priorities-home-card"/);
  assert.match(html,/class="insight-panel dashboard-card weather-home-card"/);
  assert.match(html,/class="insight-panel dashboard-card owner-briefing-card"/);
  assert.match(html,/id="homeHistoryPreview"/);
  assert.match(css,/\.home-utility-stack\{[\s\S]*grid-column:2/);
  assert.match(js,/renderHomeHistoryPreviewV320/);
});

test('business snapshot uses requested financial colors and larger profit value',()=>{
  assert.match(js,/\["Jobs Today",todayJobs\.length,"scheduleTab","green"/);
  assert.match(js,/\["Month Revenue",formatMoney\(monthPaid\),"invoiceTab","green"/);
  assert.match(js,/\["Month Expenses",formatMoney\([^\]]+\),"maintenanceTab","red"/);
  assert.match(css,/\.intelligence-card\.profit-metric strong\{font-size:25px;\}/);
});

test('phase two revision 2 uses responsive masonry spacing and relayout observers',()=>{
  assert.match(css,/--home-card-gap:12px/);
  assert.match(css,/grid-auto-rows:var\(--home-grid-row\)/);
  assert.match(js,/function initializeResponsiveHomeDashboardV320/);
  assert.match(js,/new ResizeObserver\(scheduleLayout\)/);
  assert.match(js,/new MutationObserver\(scheduleLayout\)/);
  assert.match(js,/details=>details\.addEventListener\("toggle",scheduleLayout\)/);
});

test("phase two revision 3 gives Today's Priorities category tabs with counts",()=>{
  assert.match(html,/data-priority-category="all"/);
  assert.match(html,/data-priority-category="invoice"/);
  assert.match(html,/data-priority-category="inventory"/);
  assert.match(html,/data-priority-category="maintenance"/);
  assert.match(html,/data-priority-category="customer"/);
  assert.match(html,/data-priority-category="schedule"/);
  assert.match(html,/data-priority-category="employee"/);
  assert.match(js,/let activePriorityCategoryV320 = "all"/);
  assert.match(js,/function renderPrioritiesV320/);
  assert.match(js,/function renderPriorityTabsV320/);
  assert.match(css,/\.priority-tabs\{/);
});
