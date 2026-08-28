# Paradise Lawn Care v3.20 Phase One - Completion and Testing Report

## Completed customer and property work

- Reorganized the Customer Record workflow.
- Split billing address into Street, City, State, and ZIP while preserving the combined legacy billing value.
- Added compact Phone and Email preferred-contact checkboxes to Customer, Quote, and Invoice.
- Kept Phone, Text, Email, and Smoke Signal as immediate action cards.
- Prevented the action cards from changing the saved preferred-contact setting.
- Removed the redundant standalone Text Customer and Email Customer buttons.
- Added Residential, Commercial, and HOA property types.
- Added conditional HOA field visibility.
- Replaced free-text mowing height with a 1.0-6.0 inch dropdown in 0.5-inch increments.
- Preserved multiple-property support.
- Added adaptive email sizing, compact short-data fields, uniform controls, and darker green card borders.

## Shared preferred-contact completion

- Phone and Email are now the two saved preferred-contact choices.
- Text and Smoke Signal remain immediate communication actions rather than saved preferences.
- Changing the preferred checkbox on Customer, Quote, or Invoice updates the linked customer record.
- The same preference is cascaded into all saved quotes and invoices linked to that customer.
- Loaded Customer, Quote, and Invoice screens use the customer record as the source of truth.
- Existing legacy Text and Smoke Signal preferences safely migrate to Phone; Email remains Email.
- Invoice and quote PDFs display the synchronized preferred contact.

## Preferred-payment PDF correction

The original problem was caused by Cash, Business Check, and Zelle all using the same internal value (`0`). The application could not tell them apart after reloading.

This build now uses unique identifiers:

- `cash`
- `business-check`
- `zelle`
- `credit-card`

The percentage fee is stored separately from the payment identifier. Saved invoices now retain the exact method selected, and the PDF uses the restored payment method label.

A migration routine upgrades older invoices by reading their saved payment label and fee rate without discarding other invoice information.

## Compatibility protections

- No existing localStorage key was renamed or removed.
- Existing customer, quote, invoice, property, attachment, identifier, schedule, and unrelated module data remain in place.
- Existing combined billing addresses remain readable.
- Existing property records without a type are inferred or default safely.
- Existing invoices without `paymentCode` are migrated from `paymentMethod` and `paymentRate`.

## Validation completed

- `node --check script.js`: passed.
- `node --check tests/app.test.js`: passed.
- New transfer-focused Node tests: 5 passed, 0 failed.
- Static checks confirm:
  - unique payment identifiers and fee rates;
  - payment save/reload helpers;
  - payment migration;
  - preferred-contact cascade across Customer, Quote, and Invoice;
  - preferred-contact and payment method output in the PDF;
  - action cards do not overwrite saved preference.

## Environment limitations

The complete jsdom regression suite could not be executed in this environment because the configured package mirror returned a 404 for the `xmlchars` dependency. Chromium-based local-page testing was also blocked by the environment administrator. These are testing-environment restrictions, not application failures.

The full repository test suite should be run on the user's workstation after dependencies install successfully:

```text
npm install
npm test
```

## Required final Visual Studio / browser approval checks

1. Load and resave an existing customer.
2. Create a customer and select Email as preferred.
3. Open that customer in Quote and Invoice and confirm Email is selected.
4. Change Invoice to Phone and confirm Customer and Quote reflect Phone.
5. Save invoices using Cash, Business Check, Zelle, and Credit Card.
6. Reload each invoice and confirm the exact method remains selected.
7. Open the PDF and confirm Preferred Contact and Payment Method match the screen.
8. Verify Phone, Text, Email, and Smoke Signal action cards still operate without changing preference.
9. Verify Residential, Commercial, and HOA properties save and reload.
10. Confirm Scheduling, Communications, Maps, Invoice History, and attachments remain operational.

## Status

Phase One is functionally complete in this test build and ready for final real-browser approval. It has not been merged into `main`.
