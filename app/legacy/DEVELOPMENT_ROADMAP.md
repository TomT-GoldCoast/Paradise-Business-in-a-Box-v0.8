# Paradise Lawn Care Operations Suite v3.20 Development Roadmap

Permanent project reference. **Do not delete.**

**Project philosophy:** Preserve existing functionality first. Improve second. Expand third.

## Phase status

- Phase 0 - Baseline Preservation: Complete
- Phase 1 - Customer and Property Modernization: Complete; awaiting owner browser approval
- Phase 2 - Shared Customer Data Engine: Phase One preferred-contact and payment portions completed; remaining broader data work pending
- Phase 3 - Scheduling 2.0: Pending
- Phase 4 - Smart Route Optimization: Pending
- Phase 5 - Routing and Mapping Reliability: Pending
- Phase 6 - Final Polish and Full Regression Testing: Pending

## Phase One completed items

- Customer Record redesign
- Structured billing address
- Compact and adaptive fields
- Shared Phone/Email preferred contact across Customer, Quote, Invoice, and PDFs
- Direct Phone, Text, Email, and Smoke Signal actions retained
- Exact preferred-payment persistence and PDF transfer
- Property Type and conditional HOA workflow
- Mowing-height dropdown
- Multiple-property support
- Dark green card borders and uniform styling
- Legacy data migration and compatibility protection

See `PHASE1_TESTING_REPORT.md` for implementation details, validation, and final browser checks.


## Phase 2 Completion Record

- **Date completed:** 2026-08-01
- **Branch/build:** v3.20 Phase Two test build
- **Features added:** six-card business snapshot, Today's Priorities, tabbed Owner's Daily Briefing, collapsed Inventory and Maintenance cards, one continuous Activity History ledger, calendar date filter, quick filters with All as default, automatic resolution logging, CSV export, and click-through history records.
- **Functions preserved:** Phase One customer/property workflow, preferred contact synchronization, preferred payment persistence, PDF output, billing center, scheduling, weather, maintenance, inventory, communications, and Smoke Signal.
- **Tests passed:** JavaScript syntax; Phase One transfer tests; Phase Two structural and lifecycle tests.
- **Known limitation:** Full legacy jsdom regression suite requires the repository dev dependencies to be installed on the test computer.

## Phase Two Revision - Command Center Layout Refinement

- Balanced Today's Priorities and Weather into half-width cards.
- Balanced Owner's Daily Briefing and Continuous History into half-width cards.
- Added useful condensed summaries to Maintenance and Inventory cards.
- Stacked Maintenance and Inventory on the right side.
- Standardized requested metric colors and enlarged the profit value without enlarging its card.

## Phase 2 Revision 2 - Responsive Dashboard Card Flow

**Status:** Ready for Visual Studio testing

- Replaced fixed-row dashboard spacing with a responsive masonry-style flow.
- Standardized the buffer zone between every Home card.
- Added automatic reflow when cards expand, collapse, refresh, reorder, or change content.
- Preserved a natural single-column layout on tablets and phones.

## Phase Two Revision 3 - Tabbed Today's Priorities

**Status:** Completed for Visual Studio acceptance testing

- Today's Priorities now contains All, Invoices, Inventory, Maintenance, Customers, Scheduling, and Employees tabs.
- All is the default view.
- Each tab displays a live active-task count.
- Existing urgency colors, record-opening actions, automatic resolution, and Activity History transfer are preserved.


## Revision 5 Preview - Final UI and Workflow Review

- Added Today to the Owner Daily Briefing tabs.
- Standardized separated address fields on Invoice, Quote, and Property/Profile forms while retaining legacy combined values internally.
- Improved adaptive email sizing and phone/preferred-contact proportions.
- Reordered Scheduling so the schedule is the primary workspace, followed by Navigation and the future AI suggestion workspace.
- Added user-saved communication templates.
- Strengthened radar initialization when opened from Home.
- No account-number or data-intelligence migration is included in this preview.


---

## v3.21A - Account & Data Engine

**Status:** Preview complete; browser acceptance testing required.

- Permanent user-facing Account Number (`PLC-000001`) assigned to each customer.
- Legacy Customer ID and Job ID retained internally for compatibility, but removed from normal user-facing workflow.
- Quotes, invoices, schedules, communications, alerts, history, and PDFs carry the shared Account Number.
- Invoice Number remains unique to each billing event.
- Quote Number remains unique to each quote.
- Customer changes synchronize linked quote and invoice contact information.
- Duplicate-account detection checks name, business, phone, email, and address before creating a new account.
- ZIP lookup fills City and State when an internet lookup is available; manual entry remains available.
- Saved business addresses provide local predictive suggestions without changing the selected record automatically.
- Existing records migrate in place and preserve internal IDs and compatibility aliases.


## v3.21B - Development Test Release

**Status:** Built for field testing

- Removed redundant City/State text beneath ZIP fields while preserving autofill.
- Added visible Development Build labeling and version number.
- Added first-use backup/export reminder and permanent JSON backup button.
- Added Quote/Invoice customer-link and Account Number integrity verification.
- Added full field-testing checklist for the owner.
- Requires real-browser acceptance testing before publishing as the shared development build.
