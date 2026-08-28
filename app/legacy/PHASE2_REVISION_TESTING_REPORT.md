# Paradise Lawn Care v3.20 - Phase Two Revision Testing Report

## Revision Scope

- Restored the Home weather card to a compact half-width position.
- Kept Today's Priorities at half width while preserving all priority detail.
- Placed Owner's Daily Briefing beside a compact Continuous History card.
- Added a five-entry Home history preview with direct access to the full History tab.
- Stacked Upcoming Maintenance above Inventory Warnings on the right side.
- Changed Maintenance and Inventory from empty collapsed cards to useful condensed cards that show a count and short preview while closed.
- Applied requested Business Snapshot number colors.
- Increased the Estimated Month Profit number size without increasing its card.
- Preserved darker green card borders.

## Indicator Rules

- Jobs Today: green.
- Active Alerts: red when alerts exist; green when clear.
- Overdue Invoices: red when overdue invoices exist; green when clear.
- Month Revenue: green.
- Month Expenses: red.
- Estimated Month Profit: green when positive, red when negative, with larger numeric type.
- Inventory badge: yellow when no active warning, red when warnings exist.
- Maintenance badge: red only when an open maintenance item is due within seven days or overdue; otherwise green.

## Automated Checks

- `node --check script.js`: passed.
- Phase One data-transfer tests: passed.
- Phase Two command-center and revision tests: passed.
- Focused automated total: 12 passed, 0 failed.
- Duplicate HTML ID check: passed.

## Full Suite Limitation

The complete legacy test suite could not run in this environment because the local package set does not include `fake-indexeddb`. The focused tests that do not require that missing dependency passed.

## Visual Studio Browser Acceptance Checklist

1. Confirm all six Business Snapshot cards fit on one desktop row.
2. Confirm Estimated Month Profit uses a larger number without changing card dimensions.
3. Confirm Today's Priorities and Weather share one row at approximately half width each.
4. Confirm Owner's Daily Briefing and Continuous History share one row.
5. Confirm Upcoming Maintenance appears above Inventory Warnings on the right side.
6. Confirm both utility cards show useful preview information while closed.
7. Confirm expanding either utility card reveals the full existing details and action button.
8. Confirm Weather still loads the same information and Open Radar still works.
9. Confirm History defaults to All and the Home preview displays the latest five entries.
10. Confirm Customer, Quote, Invoice, Scheduling, Communications, PDFs, and Smoke Signal remain functional.
