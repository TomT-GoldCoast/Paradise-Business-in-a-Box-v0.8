# Regression Test Report — v0.8.0

All automated suites passed after the Paradise v3.21B parity upgrade.

- Smoke/API: PASS
- Full workflow: PASS
- Quote routing/conversion: PASS
- Public website/UI: PASS
- Visual contract: PASS
- Photos/attachments: PASS
- Tenant branding: PASS
- Backup/restore: PASS
- Provider contracts: PASS
- v3.21B parity upgrade: PASS

The parity suite verifies:

- Per-Service completion populates a Ready-to-Send invoice.
- Invoice sending remains a separate explicit/manual action.
- Bi-Weekly completed work accumulates until the 14-day billing period matures, then groups into one invoice.
- Monthly completed work groups into one invoice on the configured billing anchor day.
- Manual billing never auto-populates an invoice.
- Billing queue and summary data are exposed to the app.
- Customer billing policy persists through the API.
- Employee emergency/equipment detail persists through the API.
- Payroll ledger writes are API-backed.
- Expanded maintenance records are API-backed.

Test/demo data was reset to the clean seed after regression.
