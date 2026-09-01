# Paradise Combo Web and App v0.9.0

Combo Web and App completion build for Paradise Lawn Care of the Treasure Coast LLC. The governing document remains `docs/CONSTITUTION.md`.

## Start locally

Run `START-PARADISE.bat`, then use the displayed local app/website addresses. On first production start, create the Owner account; no default password is packaged.

## v0.9.0 completion upgrades

### Isolated Training Mode
- Production begins with zero demo/customer records.
- The left sidebar switches between Production and a physically separate Training data store.
- Training Mode contains 20 fictional customer accounts and 45 practice service locations.
- Mix includes residential, fast-food/commercial, shopping center, apartment complex, and two property-management accounts with 20 and 5 locations.
- Training Mode cannot see production customers/data; Production Mode cannot see training records.
- QuickBooks and production backups are blocked while Training Mode is active.
- `Reset Training Data` restores the packaged practice dataset.

### QuickBooks Online capability
- Owner Settings includes QuickBooks Online connection status and controls.
- OAuth 2.0 authorization, encrypted token storage, refresh/revoke handling, tenant connection state, customer sync, invoice sync, and recorded-payment sync are implemented.
- No Intuit credentials are hard-coded. Hosting must supply `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, and `BIB_INTEGRATION_SECRET`.
- Invoice sync requires a QuickBooks service Item ID mapping in Settings.
- Training data can never sync to QuickBooks.

### Existing v0.8.1 security/backup completion retained
- Individual Owner / Office / Crew / Customer accounts with server-side authorization.
- Crew/customer dataset isolation.
- Owner-only production backups, hosted snapshots and Windows catch-up companion.
- Billing cycle and overpayment corrections retained.

## Data stores
- `server/data/production.json` — live tenant data.
- `server/data/production-seed.json` — clean zero-customer starting state.
- `server/data/training.json` — current practice sandbox.
- `server/data/training-seed.json` — canonical 20-account training reset state.

The old v3.21B public application has been removed from the served app folder. Only shared visual/vendor assets required by the accepted current interface remain.

## Estimate notification and customer contact configuration (v0.9.0)
Estimate requests are always saved first. Automatic company email notification can be enabled with these server environment variables:
- `SENDGRID_API_KEY` - SendGrid API key for estimate email delivery
- `ESTIMATE_FROM_EMAIL` - verified sender address
- `APP_BASE_URL` - public secure app URL included in the email notification

No SMS provider is required for the website's customer contact buttons. After a successful estimate submission, the confirmation screen provides `Call Paradise` and `Text Paradise`. These use `tel:` and `sms:` links on the customer's device, and the customer must press Send in their own messaging app. The destination number comes from the tenant/company phone setting.

The tenant's estimate notification email is configurable in Owner Settings. Provider secrets are never stored in browser settings or tenant JSON.
