# Paradise Lawn Care v3.21B Development Test Release
## Complete Testing Checklist for Field Testing

**Build:** v3.21B Development Test Release  
**Purpose:** Stability, migration, account wiring, and publishability testing.  
**Important:** Export a backup before entering or modifying real business data.

## 1. First Launch and Backup

- [ ] A visible **DEVELOPMENT BUILD – v3.21B Test Release** label appears below the header.
- [ ] The first-use backup reminder appears once in a new browser profile.
- [ ] **Export Backup Now** downloads a `.json` backup file.
- [ ] Refreshing after acknowledgment does not repeatedly show the reminder.
- [ ] The permanent **Export Backup** button in the development label works.

## 2. Existing Data Migration

- [ ] Open the build in the browser that contains the existing Paradise data.
- [ ] Existing customers remain present.
- [ ] Existing quotes remain present.
- [ ] Existing invoices remain present.
- [ ] Existing schedules remain present.
- [ ] Existing properties remain linked to the correct customers.
- [ ] No customer, property, quote, invoice, or schedule record is duplicated unexpectedly.

## 3. ZIP Autofill

Test each location with a valid five-digit ZIP:

- [ ] Customer billing address: City and State populate.
- [ ] Customer Property Profile: City and State populate.
- [ ] Quote service address: City and State populate.
- [ ] Invoice billing address: City and State populate.
- [ ] No duplicate City/State text appears underneath the ZIP field.
- [ ] City and State remain manually editable.
- [ ] An unavailable ZIP lookup does not prevent manual entry.

## 4. Permanent Account Number

- [ ] Every customer displays an Account Number formatted like `PLC-000001`.
- [ ] The same Account Number appears when the customer is loaded again.
- [ ] The Account Number appears on linked quotes.
- [ ] The Account Number appears on linked invoices.
- [ ] The Account Number appears in customer, quote, and invoice finder cards.
- [ ] Creating another invoice for the same customer retains the same Account Number.
- [ ] Each new invoice receives a different Invoice Number.

## 5. New Customer and Existing Customer Linking

- [ ] Save a new customer and confirm one permanent Account Number is created.
- [ ] Create a quote using **New Customer** and confirm the new account is linked.
- [ ] Create a quote using **Customer Account** and confirm the selected existing account is linked.
- [ ] For a customer with one property, the correct property is selected automatically where appropriate.
- [ ] For a customer with multiple properties, the selected property remains linked to the quote and invoice.
- [ ] Editing customer phone or email updates linked records as designed.

## 6. Duplicate-Customer Warning

- [ ] Enter an existing customer name on the Customer tab and confirm a possible-match warning appears.
- [ ] Test matching by phone.
- [ ] Test matching by email.
- [ ] Test matching by address.
- [ ] Open the existing account from the warning.
- [ ] Confirm the user may intentionally continue with a truly separate new account.

## 7. Quote and Invoice Relationship

- [ ] Create and save a quote for an existing account and property.
- [ ] Reload the quote and confirm customer, account, and property are unchanged.
- [ ] Convert or recreate the workflow as an invoice.
- [ ] Reload the invoice and confirm customer, account, property, payment preference, and preferred contact remain correct.
- [ ] Confirm quotes and invoices do not silently switch to another customer's property.

## 8. PDF Verification

- [ ] Invoice PDF shows the correct Invoice Number.
- [ ] Invoice PDF shows the correct Account Number.
- [ ] Invoice PDF shows the correct customer and billing address.
- [ ] Invoice PDF shows the correct preferred contact.
- [ ] Invoice PDF shows the exact preferred payment method.
- [ ] Existing older invoices still generate readable PDFs.

## 9. History and Alerts

- [ ] Open an alert that links to an invoice and confirm the correct invoice opens.
- [ ] Complete an alert and confirm it leaves the active list.
- [ ] Confirm the completed action appears in History.
- [ ] Click the History entry and confirm it opens the originating record when a link is available.
- [ ] Test History quick filters: All, Today, Yesterday, This Week, and This Month.
- [ ] Test the History calendar for a specific date.

## 10. Core Regression Walkthrough

- [ ] Customer save/load.
- [ ] Multiple-property save/load.
- [ ] Quote save/load.
- [ ] Invoice save/load.
- [ ] Preferred contact synchronization.
- [ ] Preferred payment synchronization.
- [ ] Scheduling and map pin.
- [ ] Communication actions and saved templates.
- [ ] Weather and radar.
- [ ] Maintenance and inventory cards.
- [ ] Home dashboard priorities and briefing.
- [ ] Smoke Signal action.

## Report Problems

For every issue, record:

1. Tab and action being performed.
2. Customer Account Number.
3. Quote or Invoice Number, when applicable.
4. Device and browser.
5. Expected result.
6. Actual result.
7. Screenshot.
