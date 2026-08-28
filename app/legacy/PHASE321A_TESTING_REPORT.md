# Paradise Lawn Care v3.21A - Account & Data Engine

## Scope

This phase begins the planned data wiring update while preserving the approved v3.20 Revision 8 interface.

### Implemented

- Permanent Account Number format: `PLC-000001`.
- Existing `C-######` customer numbers migrate to the matching `PLC-######` account number where possible.
- Existing internal customer IDs and job IDs remain stored for backward compatibility.
- Visible Customer ID labels are replaced by Account Number.
- Internal Job ID is hidden from the normal Invoice workflow.
- Quotes, invoices, schedules, and linked customer records carry the same Account Number.
- Invoice Number remains a separate number for each invoice.
- Quote Number remains a separate number for each quote.
- Customer contact edits synchronize to linked Quotes and Invoices.
- Duplicate-account warnings compare customer name, business name, phone, email, and address.
- ZIP lookup attempts to populate City and State using the public Zippopotam.us lookup service.
- ZIP lookup failure never blocks manual entry.
- Previously saved addresses appear as local predictive suggestions in street-address fields.
- Invoice PDF preview adds the Account Number.

## Automated validation

- `node --check script.js`: passed.
- Existing Phase One and Phase Two focused tests: passed.
- Revision 5 and Revision 7 focused tests: passed.
- v3.21A account-engine tests: passed.
- Total focused tests run: **30 passed, 0 failed**.

## Environment limitation

The repository's complete jsdom test suite could not be installed in this environment because the configured package mirror returned a 404 for the `xmlchars` dependency. The focused tests that do not require that dependency were run successfully.

## Required Visual Studio browser acceptance checks

1. Open an existing customer and confirm the Account Number begins with `PLC-` and remains unchanged after repeated saves.
2. Create a new customer and confirm one permanent Account Number is assigned.
3. Create a Quote for that customer and confirm the Quote displays and searches by the same Account Number.
4. Convert the Quote to an Invoice and confirm the Invoice has a new Invoice Number but the same Account Number.
5. Open the Invoice PDF and confirm both Invoice Number and Account Number appear.
6. Change the customer's phone, email, or preferred contact; reopen linked Quote and Invoice records and confirm the shared customer information updates.
7. Enter the same email or phone while creating another customer and confirm the possible-existing-account warning appears.
8. Enter a valid five-digit U.S. ZIP code while online and confirm City and State populate; verify manual entry still works if lookup is unavailable.
9. Type in a service address and confirm previously saved addresses appear as suggestions.
10. Open Scheduling and confirm the selected record displays Account Number, not Customer ID.
11. Confirm existing invoices, quotes, schedules, communications, History, Alerts, PDFs, routing, weather, inventory, and maintenance still open normally.

## Safety note

Do not replace the working production copy until the browser acceptance checks above are completed with a backup of browser site data.
