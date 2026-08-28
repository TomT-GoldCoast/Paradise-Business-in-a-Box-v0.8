# Modular Build Opinion

## Verdict

The Business in a Box direction is the correct architecture for Paradise **if Paradise remains Tenant #1 instead of becoming the source-code identity**.

The biggest risk in the original Paradise app is not that its features are wrong; many are useful and proven. The risk is that a single-page monolith can make each new feature touch unrelated screens, storage assumptions and event handlers. That becomes expensive when the same software must support a second, tenth or hundredth company.

## Recommended module boundaries

1. **Tenant / Brand Studio** - identity, logo, palette, domains, contacts, service areas and website content.
2. **CRM** - leads, accounts, contacts, service locations, duplicate protection and preferred contact.
3. **Sales** - estimates/quotes, status workflow, attachments and quote-to-customer/job conversion.
4. **Scheduling & Routing** - jobs, crews, calendars, route planning, map/provider adapters and late notices.
5. **Field Operations** - start/complete work, notes, photos, damage reports and service-location instructions.
6. **Billing** - invoices, payments, payment links, print/PDF documents and receivables.
7. **Communications** - templates, one-click individual actions, bulk audience preparation and provider adapters.
8. **Assets & Maintenance** - equipment, maintenance calendar, inventory and reorder alerts.
9. **Intelligence** - owner briefing, priorities, weather, dashboard metrics and reporting.
10. **History / Audit** - one append-oriented business activity ledger.
11. **Public Website / Content** - tenant marketing site, estimate capture, SEO articles and sitemap.
12. **Portals** - crew and customer experiences built on the same records and permissions.

## Why the compatibility module is deliberate

A rewrite that claims feature parity before all behavior is migrated is risky. This prototype therefore keeps the full v3.21B workspace accessible as a compatibility module. New modular replacements can be tested against it one function at a time. The compatibility module should shrink over time and eventually disappear when the parity matrix is fully native.

## Claude reference rule

The Claude Code library was used only as a repository/engineering reference. Its own guidance recommends studying architecture and writing original project-specific implementations rather than assuming public code can simply be copied. This build follows that rule.
