## v0.9.0 - Route preference controls
- Added Route Preference choices: Fastest Route, Avoid Highways, and Local Roads Preferred.
- Paradise defaults to Local Roads Preferred for lawn-service routing.
- Avoid/local-road modes use highway/toll-aware dynamic road costing; Fastest Route retains the standard OSRM path.
- Efficient-order recommendations and Google Maps handoff now honor the selected route preference.
- Route preferences remain recommendations and do not automatically alter job dates, times, or crew assignments.

## v0.9.0 — Customer classification & Crew View
- Added property-level Property Use: Residential or Commercial.
- Added property-level Lot Type: Regular Lot, Corner Lot, or Commercial Lot.
- Added Customers filters for lot type, service frequency, status, and search.
- Crew View job cards now show customer, Residential/Commercial, lot type, service frequency, address, service and property/customer/job notes.
- Training Mode classifies the 30 $120 accounts as Regular Lot and the 14 $140 accounts as Corner Lot.

## v0.9.0 — Training customer mix
- Expanded canonical Training Mode to 44 fictional recurring residential customers.
- Pricing mix: 30 regular lots at $120/month and 14 quarter-acre lots at $140/month.
- Each training customer receives four weekly mow / weed eat / edge / blow jobs per month.
- Training routes are distributed across weekdays to exercise daily route planning with realistic stop counts.

# v0.9.0 - Daily route logic correction

- Route Center now builds one route date at a time instead of chaining every open future job into one drive.
- Added an explicit Route Date selector; default is today when open work exists, otherwise the next open service date.
- Dashboard Route Center now uses only today's open jobs.
- Current device location now participates in the efficient-order recommendation when enabled.
- Training Mode no longer creates cross-date Port St. Lucie / Stuart / Jensen Beach detours.
- Added regression coverage for daily route isolation.

# v0.8.6

## Responsive device correction
- Raised sticky website/app headers above Leaflet map stacking layers.
- Added tablet/iPad header spacing rules so logo/phone artwork is not covered by Estimate/Call controls.
- Corrected conflicting tablet hero positioning that could stack logo, message, and CTAs.
- Added tablet and phone map height/width constraints for Route Center, dashboard maps, and weather radar.
- Added responsive regression contract for desktop, iPad/tablet, and phone breakpoints.

## v0.8.6 - Customer-initiated call/text estimate follow-up
- Replaced automatic outbound estimate SMS/Twilio workflow with customer-initiated `Call Paradise` and `Text Paradise` actions after a successful website estimate submission.
- `Text Paradise` opens the customer's own messaging app with the company phone number and a short prefilled message; the customer decides whether to send it.
- Estimate requests and up to eight photos are still saved before any notification/contact action.
- Automatic company email notification remains supported and is configured separately.
- Removed Twilio credentials, SMS provider status, SMS delivery status, and Email/Text preference controls from the normal estimate workflow.
- Added regression coverage for save-first estimate handling and customer-initiated phone actions.

# Changelog

## v0.8.6 — Training Isolation & QuickBooks Integration Capability

- Added sidebar Training Mode with complete server-side separation from production.
- Added 20 fictional training customers / 45 practice locations, including 20-property and 5-property management portfolios.
- Production now ships with zero demo/customer records.
- Added Reset Training Data and prevented production backup/QuickBooks operations from training.
- Added QuickBooks Online OAuth/API provider adapter with encrypted tokens, connect/disconnect, customer/invoice/payment synchronization and service Item mapping.
- Removed the legacy v3.21B application from the publicly served app tree; retained only required shared assets/vendor Leaflet files in clean locations.
- Preserved the accepted v0.8.1 security, backup, billing, branding and visual behavior.

# v0.8.0 — Paradise v3.21B Functional Parity Upgrade

- Preserved the accepted v0.7.3 public website and visual baseline.
- Added customer billing policy fields: Per Service, Bi-Weekly, Monthly, Manual, plus billing anchor date.
- Added automatic billing-cycle processing on application bootstrap when workflow automation is enabled.
- Per-service completion can immediately populate a Ready-to-Send invoice.
- Bi-weekly and monthly completed work accumulates into customer billing periods and is grouped into one invoice when the period matures.
- Automated billing populates invoices only; owner/manual send remains required.
- Added Billing Center queue, ready/pending counts, unbilled totals, Ready-to-Send review and Mark Sent action.
- Added customer type and service-frequency fields for residential/commercial and communications filtering.
- Added seven-day schedule board with direct Text, Email and Route actions.
- Expanded Communications audiences to residential, commercial/property management, weekly, biweekly, monthly, open-balance and route groups.
- Expanded employee records with email, employment type, emergency contact, emergency phone and assigned equipment.
- Added payroll ledger entry API/UI and estimated-versus-recorded payroll reporting.
- Expanded maintenance records with model, serial/asset number, current reading, vendor, cost and completion date.
- Expanded Reports to include paid revenue, operating expenses, payroll, maintenance and estimated operating profit.
- Expanded History with search, category filter and CSV export.
- Expanded Alerts with Ready-to-Send invoice and matured billing-batch priorities.
- Added a dedicated parity-upgrade regression suite.
- Retained v0.7.3 route recommendation, satellite road routing, animated radar, customer portal, tenant branding, 31 SEO articles, attachments and validated backup/restore.

## v0.8.1 — Secure Access & Resilient Backup Completion Upgrade
- Replaced demo role switching with real individual Owner / Office / Crew / Customer authentication.
- Added scrypt password hashing, HttpOnly SameSite sessions, first-run Owner setup, account invitations, 72-hour activation links and owner-managed user accounts.
- Added server-side role/data isolation; Crew only receives assigned work/customer/photo data, Customer only receives its linked account/invoices/requests, and backups are Owner-only.
- Added hosted full-backup snapshots with 30 daily / 12 weekly / 12 monthly retention.
- Added hashed Backup Device Keys and a Windows Backup Companion that prompts for one or more local destinations on first run and catches up after the PC has been offline.
- Fixed invoice overpayment application so an overpayment on one invoice cannot erase unrelated customer receivables.
- Updated package/startup/export version references to v0.8.1.

## v0.8.6
- Renamed the visible product identity to Combo Web and App and removed visible prior product wording wording.
- Unified service selections across website estimate intake and app service dropdowns.
- Removed excluded service from the service catalog.
- Added up to eight estimate-request photo uploads: four front-yard and four back-yard slots.
- Website estimate photos are compressed in-browser, saved with the lead, and viewable from the app Lead pipeline.
- Restored the production data file to the clean first-run seed after regression testing.

## v0.8.4 - Estimate email + SMS notifications
- Website estimate requests are saved before any external notification is attempted.
- Added tenant-configurable Estimate Notification Email, Estimate Notification Phone, and Email / Text / Email + Text preference in Settings.
- Paradise defaults to Email + Text.
- Added SendGrid email adapter and Twilio SMS adapter using server-only environment credentials.
- SMS alerts contain customer, property, service, phone, and app review link; estimate photos remain in the saved lead and are not sent by MMS.
- Each lead records Email Sent/Failed and SMS Sent/Failed status; provider failure never deletes or rejects the saved estimate.
- Added v0.8.4 notification contract regression coverage.
