# Business in a Box v0.3.0 Data Model

## Tenant
Identity, branding, contact data, service area, account prefix, website copy and workflow settings.

## Customer / Account
Permanent `accountNumber`, contact preferences, payment preference, status, service plan, value, balance and one or more Properties.

## Property
Tenant/customer-scoped location with label, address, service notes and active state.

## Lead
Prospect from public website or office entry. Holds source, requested service and pipeline status.

## Service
Tenant-configurable service catalog record with price, unit/description and active state.

## Quote
Unique quote number plus customer, permanent account number, property, service, amount, status and notes.

## Job
Unique work order plus customer/account/property, date/time, service, crew, duration, amount, notes and status.

## Invoice / Payment
Invoice carries customer/account/property/job relationship and line items. Payments update paid amount, invoice status and customer balance.

## Supporting records
Users/roles, team, communication templates/log, customer portal requests, expenses, inventory, maintenance and activity audit records.
