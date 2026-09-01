# Combo Web and App — Living Constitution

**Document version:** 0.4.4
**Project generation:** Combo Web and App Prototype v0.4.x  
**Status:** Authoritative governing development document  
**Purpose:** Preserve the commercial product vision, architecture, data integrity, security boundaries, test discipline, and ability to onboard future paying businesses without rewriting core source code.

---

## 1. Project identity and commercial objective

**Combo Web and App is the product.** It is being built as a commercial, repeatable, online software business intended to be sold to many service businesses.

Paradise Lawn Care of the Treasure Coast LLC is **Tenant #1, demonstration tenant, and field-service reference implementation.** Paradise Lawn Care is not the product and must never become hard-coded product identity.

Paradise Lawn Care v3.21B is an authoritative functional reference for proven field-service workflow ideas. The Claude Code working library is a secondary engineering/reference source for ideas, repository discipline, maintainability, and testing patterns. Neither reference overrides this Constitution.

The commercial promise is:

> **The customer supplies their business identity and domain. Combo Web and App delivers a professionally branded public website and the connected operating software that runs the business behind it.**

The long-term commercial target is a scalable SaaS/hosted platform capable of supporting hundreds or thousands of independent businesses.

---

## 2. Product profile comes first

Before accepting any feature, workflow, shortcut, vendor integration, or data-model decision, apply this test:

> **Does this strengthen Combo Web and App as a repeatable commercial product, or does it merely solve a Paradise-specific problem?**

Paradise-specific behavior must be expressed as one of:

1. tenant configuration;
2. industry configuration/module;
3. service catalog configuration;
4. workflow configuration;
5. provider adapter;
6. optional feature flag.

If onboarding the next paying business requires editing core source code, the design is incomplete.

---

## 3. One platform, multiple experiences

Combo Web and App is one connected platform with one canonical data model and one API.

Different participants receive different experiences based on authentication, permissions, business relationship, and device:

- **Owner / Administrator:** command center, business settings, financials, staff, reports, integrations, configuration.
- **Office / Dispatcher / Manager:** leads, CRM, quotes, accounts, contacts, locations, scheduling, jobs, billing, communication.
- **Crew / Field User:** phone-first route, assigned jobs, navigation, location instructions, start/complete work, photos, notes.
- **Customer / Client Portal User:** authorized accounts/locations, service history, upcoming service, invoices, payments, requests, communication.
- **Public Website Visitor:** anonymous marketing, lead capture, quote/request workflows, booking where enabled.
- **Platform Administrator:** tenant provisioning, plans, platform health, feature flags, support tooling, tenant-level configuration.

These are **not separate sources of truth**. Role/device changes the interface, not the underlying records.

---

## 4. Configuration hierarchy

Configuration must be separated into three levels:

### Platform configuration
Rules controlled by Combo Web and App:
- core entities;
- security rules;
- workflow framework;
- billing engine;
- API conventions;
- platform feature flags;
- provisioning rules.

### Industry configuration
Rules shared by a vertical:
- visible terminology;
- industry-specific location attributes;
- service templates;
- workflow defaults;
- document templates;
- optional modules.

Examples:
- Lawn care may display **Property**.
- Commercial cleaning may display **Building**.
- HVAC may display **Service Location**.

The canonical entity remains **Service Location**.

### Tenant configuration
Business-specific identity and operating choices:
- legal/display name;
- logo and brand assets;
- colors;
- domain;
- phone/email/address;
- service area;
- account-number prefix;
- website content;
- services and pricing;
- employees/crews;
- billing preferences;
- workflow toggles;
- enabled optional modules.

Tenant branding and business settings must be changeable without source-code edits.

---

## 5. Provisioning engine

A new paying business must be created by provisioning, not by cloning source code.

Target provisioning sequence:

`Create Tenant → Select Industry Pack → Apply Branding → Configure Domain → Create Owner User → Configure Services → Apply Workflow Defaults → Enable Modules → Publish Website`

Paradise Lawn Care is the first fully populated provisioned tenant.

The codebase is shared. Tenant data and configuration are isolated.

---

## 6. API-first rule

The public website, owner/office application, crew experience, customer portal, mobile clients, future native apps, and third-party integrations must communicate through documented APIs.

The UI must not directly write authoritative storage.

Production APIs should be versioned, for example:

`/api/v1/...`

Internal storage implementation may change without requiring the user interfaces to be rewritten.

---

## 7. Storage and cloud-readiness rule

Browser `localStorage` is never an authoritative production database.

Prototype persistence may use a local adapter, but production storage must support:

- relational persistence;
- tenant isolation;
- transactions;
- backups;
- migrations;
- auditability;
- indexing;
- recovery;
- object/file storage;
- queue/event infrastructure.

The production target is a relational cloud database such as PostgreSQL or equivalent, plus object storage and background-job/event processing.

Storage must remain behind a repository/storage abstraction.

---

## 8. Tenant isolation rule

Every persisted business record must be tenant-scoped.

Production authorization and database access must prevent one tenant from reading or modifying another tenant's data even if a frontend request is malformed.

Tenant filtering must occur at the trusted server/repository/database boundary, not merely in the UI.

A production request must derive tenant identity from authenticated context, not blindly trust a client-supplied tenant ID.

---

## 9. Authentication and authorization are separate

Authentication answers **who is this user?**

Authorization answers **what may this user do?**

Roles are convenient permission bundles, not the final security model.

Granular permissions should support capabilities such as:

- `lead.create`
- `quote.create`
- `quote.accept`
- `account.edit`
- `location.edit`
- `job.schedule`
- `job.start`
- `job.complete`
- `invoice.create`
- `payment.record`
- `employee.manage`
- `payroll.view`
- `settings.branding.edit`
- `reports.financial.view`

Permissions must be enforced server-side.

---

## 10. Canonical commercial data model

Core generic entities are:

`Tenant`
`User`
`Role / Permission`
`Lead / Prospect`
`Account`
`Contact`
`Service Location`
`Account–Contact Relationship`
`Contact–Location Relationship`
`Account–Location Relationship`
`Service`
`Contract / Service Plan`
`Quote / Proposal`
`Job / Work Order`
`Invoice`
`Financial Transaction / Payment`
`Communication`
`File / Photo`
`Audit Event`

Supporting operational entities may include:
- crews/employees;
- routes;
- schedules;
- customer requests;
- expenses;
- equipment;
- maintenance;
- inventory;
- forms/checklists;
- reminders;
- webhooks;
- integrations.

Industry-specific labels may decorate these entities but must not create incompatible core schemas.

---

## 11. Account, contact, and service-location model

Do not reduce the commercial model to `Customer → properties[]`.

### Account
Represents the contractual/commercial relationship.

Examples:
- an individual homeowner;
- ABC Property Management LLC;
- Palm Grove HOA;
- a dealership;
- a commercial client.

### Contact
Represents a person associated with an account.

An account may have many contacts with independent:
- roles;
- contact methods;
- communication preferences;
- portal access;
- billing responsibilities;
- location responsibilities.

### Service Location
Represents where work is performed.

A location carries operational knowledge, including universal fields such as:
- location name;
- address;
- access instructions;
- safety notes;
- service notes;
- active/inactive state.

Industry modules may add attributes such as:
- lawn mowing height;
- gate information;
- irrigation notes;
- HVAC equipment;
- cleaning access/alarm instructions.

Contacts, accounts, and locations are independent records joined by relationships.

---

## 12. Service account, managing account, and billing account must be separable

The party receiving service, the organization managing the site, and the party paying the invoice may be different.

The system must be capable of representing:

- **Service Account**
- **Managing Organization**
- **Billing Account**
- **Service Location**
- **Site Contact**
- **Accounts-Payable Contact**

Do not duplicate a location merely because multiple organizations or contacts have relationships with it.

---

## 13. Multi-property and portfolio customers

Combo Web and App must support organizations with many locations.

Examples:
- property management companies;
- HOAs;
- retail chains;
- commercial maintenance clients;
- franchise groups.

A contact may have access to:
- one location;
- selected locations;
- a location group;
- all account locations.

Customer portal permissions should follow these relationships.

Large portfolios must not require separate duplicate customer accounts for each property.

---

## 14. Billing-policy model

Billing must support more than one-job-one-invoice.

Supported target policies include:

- per job;
- weekly;
- biweekly;
- monthly;
- consolidated by account;
- separate by location;
- custom billing group;
- contract milestone;
- deposit + balance;
- manual/custom schedule.

A single account may have different billing rules for different contracts or locations.

Billing recipient and service contact must be independently configurable.

---

## 15. Contract / service-plan rule

Recurring work must be represented by a first-class **Contract / Service Plan**, not merely by repeatedly cloned jobs.

A contract may define:

- account;
- billing account;
- service locations;
- services;
- effective dates;
- recurrence/frequency;
- pricing;
- included/excluded work;
- assigned crews;
- billing policy;
- renewal rules;
- service windows;
- exceptions;
- pause/cancel state.

Jobs are execution instances generated from or associated with the contract.

---

## 16. Flexible entry paths

Combo Web and App must not force every company into one sales path.

Supported target paths include:

`Lead → Quote → Account/Customer → Job → Invoice → Payment`

`Lead → Account/Customer → Quote → Job → Invoice → Payment`

`Quote-first Prospect → Account/Customer → Job → Invoice → Payment`

`Existing Account → Quote → Job → Invoice → Payment`

`Existing Account → Job → Invoice → Payment`

A person requesting a quote does not have to become a permanent customer before the quote exists.

Quote-first workflows should maintain a prospect/contact record and create the permanent account only when appropriate.

---

## 17. Universal creation rule

The product should evolve toward a universal **+ Create** entry point that can create:

- Lead;
- Account;
- Contact;
- Location;
- Quote;
- Job;
- Invoice.

The system should request only the minimum required information and create/link supporting records intelligently.

Convenience must never sacrifice relationship integrity.

---

## 18. Workflow/state-machine rule

Important business objects must use defined legal state transitions.

Examples:

### Lead
`New → Contacted → Qualified → Quoted → Won / Lost / Archived`

### Quote
`Draft → Sent → Viewed → Accepted / Declined / Expired → Converted`

### Job
`Draft → Scheduled → In Progress → Completed / Cancelled`

### Invoice
`Draft → Issued → Partially Paid → Paid / Past Due / Void`

Transitions must be validated by trusted domain services/API logic, not merely by UI buttons.

Impossible or duplicate transitions must be rejected safely.

---

## 19. Transaction/orchestration rule

Business conversions must be treated as controlled transactions.

Examples:
- accepting a quote;
- creating a customer from a prospect;
- generating jobs from an accepted proposal;
- completing a job;
- creating an invoice;
- recording a payment.

A failed multi-step conversion must not leave half-created records.

Where the database supports transactions, related writes should commit or roll back together.

---

## 20. Idempotency rule

Retrying an action must not create duplicates.

Double clicks, browser retries, network retries, webhook retries, and background-job retries must be safe.

Conversion endpoints and financially significant operations should accept or derive idempotency keys and return the already-created result when the same operation is repeated.

Examples:
- quote acceptance must not create two jobs;
- job completion must not create duplicate invoices;
- payment provider callbacks must not post the same payment twice.

---

## 21. Event-driven wiring

Important domain actions should emit business events after successful state changes.

Examples:

- `LeadCreated`
- `QuoteSent`
- `QuoteAccepted`
- `AccountCreated`
- `ContractActivated`
- `JobScheduled`
- `JobStarted`
- `JobCompleted`
- `InvoiceIssued`
- `PaymentReceived`
- `CustomerPortalRequestCreated`

Email, SMS, analytics, accounting synchronization, webhooks, AI, reports, and other secondary behavior should react to events where practical rather than being tightly embedded in the primary transaction.

---

## 22. Immutable source-chain rule

The lineage between business records must be preserved.

A record created by another record must retain permanent references to its source.

Example:

`Lead L-1042 → Quote Q-0184 → Account A-0137 → Contract C-0041 / Job J-0231 → Invoice I-0158 → Payment P-0077`

This chain supports:
- sales attribution;
- reporting;
- auditing;
- customer support;
- troubleshooting;
- analytics;
- future AI insights.

A conversion must never silently destroy its source record.

---

## 23. Audit/history rule

Operationally and financially significant actions must produce immutable audit events containing, where applicable:

- tenant;
- actor/user;
- role;
- timestamp;
- action;
- entity type and ID;
- prior state;
- resulting state;
- origin/channel;
- relevant metadata.

History must distinguish between:
- user action;
- website action;
- automation;
- integration;
- system-generated action.

Important records should be archived/soft-deleted rather than silently erased.

---

## 24. Financial-ledger rule

`invoice.balance` is a derived value, not the accounting ledger.

Financial activity must be represented by immutable transactions such as:

- payment;
- deposit;
- credit;
- refund;
- adjustment;
- tax;
- processing fee;
- write-off.

Invoice totals, paid amount, and balance should be derived from line items and financial transactions.

Financial records must not be destructively overwritten.

---

## 25. Website integration rule

The connected public website is the customer-facing edge of the same platform.

It must:
- consume tenant branding/configuration from the platform;
- consume enabled services/content;
- submit leads/requests through public APIs;
- use the same authoritative tenant/business rules;
- avoid a separate business database.

Changes in tenant configuration should be capable of affecting both the operating application and public website without code edits.

Future website features may include:
- quote requests;
- self-service booking;
- customer login;
- service availability;
- service-area rules;
- payment links;
- review/referral flows.

---

## 26. Branding and white-label rule

Branding must be replaceable through configuration.

At minimum:
- legal name;
- display name;
- logo;
- favicon;
- brand colors;
- typography choices where supported;
- domain;
- public phone;
- public email;
- address;
- service area;
- website hero content;
- calls to action;
- service names/descriptions;
- document branding;
- customer portal identity;
- outgoing-message identity.

A tenant must not require manual search-and-replace across source files.

---

## 27. Provider independence

Email, SMS, payments, maps, geocoding, accounting, AI, weather, file storage, identity providers, and other external services should be connected through adapters/interfaces where practical.

Core business workflows must not depend irreversibly on one vendor.

Provider-specific IDs and payloads belong at integration boundaries, not throughout the canonical domain model.

---

## 28. Background jobs and webhooks

Slow or retryable work should not block core user actions unnecessarily.

Background processing should be used for work such as:
- email/SMS sending;
- PDF generation;
- image processing;
- recurring-job generation;
- large imports;
- external synchronization;
- webhooks;
- scheduled reminders.

Incoming webhooks must be:
- authenticated/verified when supported;
- idempotent;
- auditable;
- retry-safe.

---

## 29. Validation and error-handling rule

Validation belongs in trusted domain/API layers, not only in forms.

The system must produce structured errors that distinguish:
- validation failure;
- permission failure;
- not found;
- conflict;
- illegal workflow transition;
- provider failure;
- server failure.

User interfaces should receive actionable messages without exposing sensitive internal implementation details.

---

## 30. File and photo architecture

Photos, documents, signatures, generated PDFs, and attachments must be stored in object/file storage in production.

The relational database stores metadata and relationships, not large binary payloads.

Files must be tenant-scoped and permission-controlled.

---

## 31. Data migrations and schema evolution

Production data structures must change through versioned migrations.

Do not rely on manually editing production records or silently changing JSON shapes.

Migrations must be:
- repeatable;
- reviewable;
- tested;
- reversible where practical;
- compatible with backups and recovery.

---

## 32. Soft deletion and retention

Business records with operational, contractual, audit, or financial significance should not be permanently deleted through routine UI actions.

Use statuses such as:
- archived;
- inactive;
- cancelled;
- void.

Hard deletion should be exceptional, permission-controlled, and subject to retention/legal requirements.

---

## 33. Testing rule

Every release must pass automated tests appropriate to the records and workflows modified.

Minimum expectations include:

- syntax/build validation;
- API health test;
- authorization checks;
- tenant-isolation tests when multi-tenancy is enabled;
- workflow/state-transition tests;
- idempotency tests for conversions and payments;
- end-to-end vertical-slice workflow;
- demo reset verification;
- regression tests for fixed defects.

Critical end-to-end test target:

`Lead/Prospect → Quote → Account/Contact/Location → Job → Invoice → Payment`

Portfolio test target:

`Organization Account → Multiple Contacts → Multiple Locations → Contract/Quote → Consolidated or Location Billing`

Demo/test data must be clearly non-production and resettable.

---

## 34. Observability and recoverability

Production architecture must support:
- structured logs;
- error tracking;
- health checks;
- database backups;
- restore testing;
- operational metrics;
- background-job monitoring;
- integration failure visibility.

The system must fail visibly and recoverably rather than silently losing business actions.

---

## 35. Performance and scale rule

Do not prematurely optimize every feature, but avoid designs that require loading an entire tenant dataset into memory or the browser.

List screens should support:
- server-side filtering;
- pagination;
- search;
- indexed queries;
- bounded payloads.

The architecture should support tenants ranging from a one-person service company to organizations with many employees, contacts, locations, jobs, invoices, and years of history.

---

## 36. UI and professional-design standard

The product must look credible enough to sell to a paying business owner.

The interface must remain:
- professional;
- restrained;
- consistent;
- readable;
- responsive;
- accessible;
- fast to understand.

Reuse a coherent design system for:
- typography;
- spacing;
- cards;
- tables;
- forms;
- dialogs/drawers;
- navigation;
- status badges;
- buttons;
- empty states;
- loading/error states.

Do not allow feature growth to create a patchwork of unrelated designs.

Mobile/field interfaces should prioritize speed and task completion over desktop information density.

---

## 37. Progressive-complexity rule

Simple businesses should see simple workflows.

Advanced account/contact/location/billing relationships should appear only when needed.

Example:
- Residential customer: simple name + property experience.
- Property management company: account + contacts + many locations + billing policy + portal scopes.

Enterprise capability must not make a small operator's daily workflow unnecessarily complicated.

---

## 38. Reference-code rule

Paradise Lawn Care v3.21B may contribute:
- proven workflow ideas;
- data-field ideas;
- service-location operational details;
- scheduling concepts;
- billing concepts;
- communication concepts;
- employee/crew concepts;
- maintenance/inventory concepts;
- test/demo patterns;
- compatible reusable code where licensing/ownership and architecture permit.

Reference code must be adapted to the Combo Web and App architecture rather than forcing Combo Web and App back into a browser-local monolith.

The Claude Code working library may contribute engineering and design ideas where useful, but Combo Web and App remains an independent codebase.

---

## 39. Commercial scalability test

Before accepting a major decision, ask all of the following:

1. Can the next paying business use this without modifying core source code?
2. Can the same concept work for a different service industry?
3. Can the website and operating application share the same authoritative data?
4. Can permissions prevent inappropriate access?
5. Can the action be audited?
6. Can the workflow survive retries and partial failures?
7. Can the data migrate to production cloud infrastructure?
8. Can we explain and support this behavior for hundreds of tenants?
9. Does this create long-term product value rather than Paradise-only convenience?

If not, redesign before the dependency spreads.

---

## 40. Development priority order

Unless a deliberate product decision overrides it, prioritize development in this order:

1. **Data integrity and tenant architecture**
2. **Security and permission boundaries**
3. **Account/contact/location relationships**
4. **Workflow/state engine**
5. **Transaction/idempotency protections**
6. **Audit/event infrastructure**
7. **Contracts/service plans**
8. **Financial ledger and billing policies**
9. **Provisioning and interchangeable branding**
10. **Connected website workflows**
11. **Owner/office/crew/customer usability**
12. **Provider integrations**
13. **Reporting/analytics**
14. **AI/advanced automation**
15. **Additional vertical industry packs**

New visual features must not outrun the integrity of the underlying business engine.

---

## 41. Current project truth

As of this Constitution revision:

- Combo Web and App is the commercial product.
- Paradise Lawn Care of the Treasure Coast LLC is the first demonstration tenant and workflow reference.
- Paradise Lawn Care v3.21B is the principal functional reference package.
- The Claude Code working library is an auxiliary engineering/reference source.
- The product is intended to provide a connected branded website plus operating system.
- One platform serves owner, office, crew, customer, public website, and future platform-administrator experiences.
- Interchangeable tenant branding is mandatory.
- Cloud persistence is the production direction; browser-local persistence is not.
- Account/contact/service-location relationships are required for commercial portfolios.
- Service account, managing organization, billing account, site contact, and billing contact may all differ.
- Contracts/service plans must become first-class objects.
- Flexible lead-first, quote-first, customer-first, and direct-job workflows are required.
- Workflow state machines, idempotency, events, audit history, financial ledgering, tenant isolation, granular permissions, API versioning, and provisioning are architectural requirements.
- The platform must remain professionally designed and commercially presentable.
- The next-paying-business test remains the final architectural filter.

---

## 42. v0.4.0 implementation checkpoint

The v0.4.0 prototype implements the first working slice of the expanded Constitution: organization/individual account types, multiple contacts, service-location relationships, account billing policies, first-class contracts, quote-first prospects, quote-to-account/job conversion, idempotent quote conversion, lifecycle audit events, and immutable payment transaction records. Legacy `customers` and `properties[]` names remain compatibility aliases in the prototype and are not the final production schema.

---

## 43. Amendment rule

This is a living document.

It must be reviewed and revised when:
- a new architecture decision changes a governing assumption;
- a new industry exposes a missing abstraction;
- a production integration introduces a new dependency;
- security, billing, or tenant isolation rules change;
- a feature request conflicts with an existing rule;
- implementation reveals that a governing rule is incomplete or impractical.

Changes to this Constitution should be deliberate, versioned, and reflected in architecture/data-model documentation where applicable.

**When implementation and this Constitution disagree, stop and resolve the disagreement rather than silently allowing them to drift apart.**


## 43. Quote routing and conversion rule

Quote status and quote conversion are distinct concepts and must never be conflated in a way that produces a dead-end user state.

The target quote lifecycle is:

`Draft -> Sent -> Viewed -> Accepted / Declined / Expired -> Converted`

Permitted shortcuts may include `Draft -> Accepted` for an in-person or otherwise already-approved quote.

Rules:

- Quote forms edit quote content, not arbitrary workflow state.
- Workflow status changes occur through explicit validated actions.
- An **Accepted** quote must always expose an obvious next action.
- For an existing account, Accepted -> Converted creates the job/work order and preserves the quote source link.
- For a quote-first prospect, Accepted -> Converted may create the permanent account/contact/location and job in one controlled transaction.
- Conversion must be idempotent; retrying the same conversion may return the prior result but must not create duplicate jobs or accounts.
- A Converted quote remains part of the immutable source chain and must retain its converted customer/account and job references.
- Illegal state transitions must be rejected by trusted API/domain logic rather than only hidden in the user interface.
- No quote may become Accepted merely because a form field happened to contain that text.

This rule was added after hands-on v0.4.0 testing exposed a dead end in which manually setting a quote to Accepted hid the conversion action.


## 43. Navigation and viewport integrity

Primary navigation must remain fully reachable at supported desktop, laptop, tablet, and mobile viewport heights. A navigation rail may not hide modules merely because its content exceeds viewport height.

For persistent side navigation:
- brand/tenant identity may remain fixed within the rail;
- the navigation list must receive the available remaining height and scroll independently;
- flex/grid children that own scrolling must use a bounded size (`min-height: 0` or equivalent);
- vertical scrolling must not force horizontal overflow;
- short viewports and browser zoom must remain usable;
- mobile drawers must use dynamic viewport sizing where supported;
- navigation scrolling must not break page scrolling, modal scrolling, or drawer-close behavior.

A release that adds enough navigation items to exceed a typical laptop-height viewport must include a viewport/overflow regression check.

## 44. Amendment — v0.4.2 navigation repair

The v0.4.2 implementation corrected the left navigation rail so its menu scrolls independently while brand identity, tenant summary, and footer remain reachable. The governing rule is now permanent: adding modules must never make existing modules unreachable because of viewport height.
