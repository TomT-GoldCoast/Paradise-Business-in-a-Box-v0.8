# Paradise Lawn Care v3.20 - Revision 7 Preview Testing Report

## Scope

This correction preview implements the last agreed visual workflow changes before the account/data-wiring phase:

- Quote Builder defaults to New Customer.
- Existing Customer Account remains available as the alternate workflow.
- The large permanent Property / Job Site selector was removed.
- A compact property selector appears only when an existing account has multiple properties.
- Quote entry now follows Business Name, Client Name, Service Address, City, State, ZIP, Phone, and Email.
- All Customer, Quote, and Invoice email rows use the same reusable responsive field shell.
- Communication recipient actions now use the same Phone, Text, Email, and Smoke Signal icons and visual language as the field contact actions.

## Automated validation completed

- `node --check script.js`: passed.
- Focused Phase One, Phase Two, Revision 5, and Revision 7 tests: 24 passed, 0 failed.
- Duplicate HTML ID inspection: passed.

## Full-suite limitation

The legacy simulated-browser suite still requires `fake-indexeddb`, which is not installed in this execution environment. The focused tests do not replace final real-browser acceptance testing.

## Visual Studio browser acceptance checklist

1. Open Quote Builder and confirm New Customer is selected by default.
2. Enter a business or client name, full service address, phone, and email; save the quote and confirm the new customer appears in Customers.
3. Choose Customer Account, select a saved one-property customer, and confirm the property is selected automatically without a large second selector.
4. Select a multi-property account and confirm the compact Property / Job Site control appears.
5. Type short and long emails on Customer, Quote, and Invoice screens and confirm the field grows only within available space.
6. Confirm the Preferred checkbox remains compact and aligned on every email row.
7. Open Communications and confirm Call, Text, Email, and Smoke Signal buttons show matching icons and equal sizing.
8. Recheck Quote save/load, conversion to Invoice, PDF output, and preferred-contact synchronization.
