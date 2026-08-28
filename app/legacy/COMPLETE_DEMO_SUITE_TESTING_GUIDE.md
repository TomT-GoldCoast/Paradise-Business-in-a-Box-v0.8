# Paradise Lawn Care Complete Development Demo Suite

## Purpose

The Complete Development Demo Suite provides a removable, realistic test database that exercises the connected Paradise Lawn Care workflow without affecting real records.

## Install and Delete

Use the existing demo controls:

- **Install Complete Demo Suite** adds all demo-marked records.
- **Delete Complete Demo Suite** removes only records marked as part of this suite.

Real customer, invoice, schedule, inventory, maintenance, payroll, expense, communication, and history records are not removed.

## Coverage

The suite installs:

- 15 customer accounts
- Residential, commercial, HOA, and rental customers
- Single-property and multi-property accounts
- Two different customers with the same name for duplicate-detection testing
- A deliberately long email address for responsive-field testing
- Approximately 20 properties
- Quotes in Draft, Pending, Accepted, Declined, and Converted states
- Multiple invoices under the same account
- Paid, Unpaid, Overdue, Ready to Email, and Draft invoices
- Cash, Business Check, Zelle, ACH, and Credit Card payment methods
- Weekly, biweekly, monthly, seasonal, and one-time frequencies
- Today, tomorrow, weekly, biweekly, monthly, completed, cancelled, and past-due schedule examples
- Active, vacation, and unavailable employees
- Payroll and operating expenses
- Normal, low, and out-of-stock inventory
- Completed, open, upcoming, overdue, and verified maintenance
- User-saved communication templates
- Activity History entries and active dashboard alerts

## Recommended Test Accounts

### PLC-DEMO-0001 - Elena Ramirez
Tests a basic residential customer, preferred Text contact, paid invoice, and single property.

### PLC-DEMO-0002 - Coleman Rental Homes
Tests one account with three properties, monthly billing, multiple quotes, multiple invoices, and property selection.

### PLC-DEMO-0003 - Harbor Pines HOA
Tests HOA classification, gate code, time restrictions, recurring service, and HOA-related scheduling.

### PLC-DEMO-0004 - Treasure Coast Medical Plaza
Tests commercial service, biweekly billing, commercial notes, and larger invoices.

### PLC-DEMO-0006 - Ellis Coastal Properties
Tests mixed commercial and residential properties under one account.

### PLC-DEMO-0009 - Sunset Bay HOA
Tests two HOA job sites under one account.

### PLC-DEMO-0013 and PLC-DEMO-0014 - John Smith
Tests duplicate-name detection while preserving two genuinely different people/accounts.

### PLC-DEMO-0015 - Grace Turner
Tests a long email address and responsive email-field behavior.

## Full Workflow Test

1. Open a demo customer and confirm the Account Number.
2. Switch between multiple properties on a multi-property account.
3. Open a linked quote and convert or review it.
4. Open multiple invoices under the same account.
5. Confirm Paid, Unpaid, Overdue, Ready to Email, and Draft states.
6. Confirm preferred payment methods survive save/reload/PDF preview.
7. Review today's and future schedule entries.
8. Mark a scheduled job complete and confirm dashboard/history changes.
9. Review Inventory warnings and Maintenance alerts.
10. Use Communications with a demo recipient and saved template.
11. Search History by All, Today, date, category, account, or action.
12. Delete the Complete Demo Suite and confirm real records remain.
