# Paradise Lawn Care v3.21B Parity Record — v0.8.0

Paradise Lawn Care v3.21B remains the lawn-care functional reference. Combo Web and App remains the reusable product architecture.

| Paradise capability | v0.8.0 status | Result |
|---|---|---|
| Customers / permanent account | API-backed account + multi-property model | Better |
| Preferred contact | Stored on account, inherited into quotes/invoices, direct customer/schedule actions | Equivalent / improved architecture |
| Customer billing method | Per Service, Bi-Weekly, Monthly, Manual + anchor date | Restored and improved |
| Billing center | Completed work groups into billing periods; invoices populate Ready to Send; owner sends manually | Restored in API architecture |
| Quotes | State machine, prospect-first/customer-first, conversion protection | Better |
| Schedule | Seven-day board + shared editable jobs + contact/route handoff | Equivalent / improved integration |
| Routing | Satellite/street layers, road geometry, optional live origin, recommendation without silent reordering | Better |
| Jobs | Dedicated status lifecycle and crew records | Better |
| Crew Mode | Restricted field view, navigation/jobs/photos without owner finance | Better |
| Invoices/payments | Grouped billing, manual send state, partial/full payments, customer portal visibility | Better |
| Communications | Templates plus customer-type/frequency/balance/route targeting | Equivalent / improved architecture |
| Employees | Rate, skills, equipment, employment type, emergency contact | Equivalent |
| Payroll | Dedicated payroll ledger plus job-duration estimate | Better visibility |
| Maintenance | Asset/model/serial/reading/vendor/cost/due/completion fields | Equivalent / improved storage |
| Inventory | API-backed quantity/reorder monitoring | Better architecture |
| Expenses | API-backed operating expense ledger | Equivalent |
| Weather/radar | NWS forecast + Leaflet + animated RainViewer radar | Equivalent / improved integration |
| Alerts | Derived priorities plus billing-ready warnings | Equivalent for active operating priorities |
| History | Shared audit ledger + search/category filtering + CSV export | Equivalent / improved shared record |
| Photos/attachments | Owner + crew image attachments against job/customer/property | Better |
| Backup/restore | Validated full export and restore | Better |
| Customer portal | Services, billing, messages/requests, account/property context | New / better |
| Public website | Connected lead intake, tenant branding, five service areas, 31 SEO articles | New / better |
| Multi-tenant | Paradise is Tenant #1; shared core remains rebrandable | Major improvement |

## Billing behavior

When workflow billing automation is enabled, completing a job marks the service billable. The customer's policy controls what happens next:

- **Per Service** — one Ready-to-Send invoice is populated for the completed service.
- **Bi-Weekly** — completed services accumulate in the 14-day period and one grouped Ready-to-Send invoice is populated when the period matures.
- **Monthly** — completed services accumulate in the customer's monthly billing period and one grouped Ready-to-Send invoice is populated when the billing day is reached.
- **Manual** — no automatic invoice is populated.

No automated billing mode automatically sends the invoice. The office/owner reviews it and uses **Mark Sent** manually.

## Remaining production adapters

These are deployment integrations rather than missing v3.21B parity:

- JSON tenant storage -> production database / tenant isolation.
- Base64 attachments -> object storage.
- Demo role selector -> authentication/authorization service.
- Mark Sent / mailto/sms handoff -> transactional email/SMS provider.
- Public routing/weather providers -> configurable commercial provider if an SLA is required.
- Customer portal payment button -> configured PCI-compliant payment processor.
