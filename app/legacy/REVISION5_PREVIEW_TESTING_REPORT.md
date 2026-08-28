# Paradise Lawn Care v3.20 Revision 5 Preview Testing Report

## Scope
Final placement and appearance review before account-number and smart-address changes.

## Included
- Four Owner Daily Briefing tabs: Today, Tomorrow, This Week, This Month.
- Compact Invoice client card with separate city/state/ZIP fields.
- Separate Quote service street/city/state/ZIP fields.
- Separate Property Profile service street/city/state/ZIP fields.
- Adaptive email sizing and wider phone entry area.
- Schedule workspace moved ahead of Navigation; collapsible navigation and AI preview cards follow.
- User-saved Communication templates.
- Radar reinitialization on Weather-tab opening.
- History wiring retained and covered by existing focused tests.

## Browser Acceptance Checklist
1. Open Home and verify all four briefing tabs fit without overflow.
2. Create and reopen an invoice; confirm city/state/ZIP remain visible and PDF still uses the full address.
3. Create and reopen a quote; confirm the complete service address survives.
4. Save and reopen a customer with multiple properties; confirm each separated job-site address survives and Open Map uses the full address.
5. Verify long email addresses remain visible on Customer, Quote, and Invoice.
6. Verify an 11-digit phone number and Preferred control fit without overlap.
7. Verify Scheduling order: schedule, navigation, AI preview.
8. Save a custom communication template, reload the page, select it, and delete it.
9. From Home select Open Radar and confirm the radar appears without manually clicking Weather again.
10. Open History and verify All remains the default filter and recent entries render.

## Automated Validation
- JavaScript syntax check: passed.
- Focused Phase One, Phase Two, and Revision 5 tests: 19 passed, 0 failed.
- Duplicate HTML ID check: passed.
- Full legacy suite remains blocked because fake-indexeddb is not installed in this environment.
