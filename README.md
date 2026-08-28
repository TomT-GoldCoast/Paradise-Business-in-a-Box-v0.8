# Paradise Business in a Box v0.8.0

Paradise Lawn Care of the Treasure Coast is Tenant #1 / flagship implementation of the reusable Business in a Box platform.

## Start on Windows

Double-click `START-PARADISE.bat`, or run:

    npm start

Then open:

- Website: http://localhost:4173/website
- Business app: http://localhost:4173/app
- Customer portal demo entry: http://localhost:4173/app?role=customer

## v0.8.0 focus — v3.21B functional parity upgrade

This release preserves the accepted v0.7.3 website/app appearance and brings forward the strongest remaining operational behavior from Paradise Lawn Care v3.21B into the API-backed Business in a Box architecture.

Key upgrades:

- Customer billing policies: Per Service, Bi-Weekly, Monthly, Manual.
- Completed jobs enter the billing cycle automatically when enabled.
- Mature billing periods populate grouped invoices automatically as `Ready to Send`; sending remains manual.
- Billing Center shows ready/pending batches, unbilled work, ready-to-send invoices, manual send state and payments.
- Seven-day schedule board plus shared job table and direct Text / Email / Route actions.
- Expanded preferred-contact behavior and targeted communications audiences.
- Employee records now include employment type, emergency contact, equipment assignment and payroll ledger.
- Maintenance records include asset/model/serial/reading/vendor/cost/completion detail.
- History now supports search, category filtering and CSV export.
- Alerts include ready-to-send invoices and matured billing batches.
- Reports include paid revenue, operating expense, payroll and maintenance cost visibility.

The public website remains estimate-only; no fixed lawn-maintenance pricing is published.
