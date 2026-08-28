# Paradise Lawn Care v3.20 - Revision 6 Preview Testing Report

## Scope

This is a UI correction pass only. It intentionally does not introduce account-number migration, ZIP autofill, predictive address lookup, duplicate-customer detection, or database architecture changes.

## Corrections included

- Replaced the broken adaptive email-width implementation with a stable responsive email field.
- Kept the Preferred checkbox compact inside the phone/email row.
- Increased usable phone-number space.
- Consolidated Quote Scope of Work and Notes into one visible field while preserving legacy saved notes when older quotes are opened.
- Stacked Estimated Amount and Frequency beside Scope of Work on desktop.
- Simplified the Quote customer/property selection hierarchy.
- Preserved separate Service Address, City, State, and ZIP fields.
- Standardized button geometry across the application.
- Preserved larger touch-friendly Phone, Text, Email, and Smoke Signal cards.
- Restyled Communication recipient action buttons to match the same contact-action visual language in a compact size.
- Left the approved Home, Scheduling, Weather, History, and Alerts workflows intact.

## Automated checks

- JavaScript syntax check: **passed**
- HTML duplicate-ID check: **passed**
- Focused built-in tests: **19 passed**
- The full browser-simulation test file could not start because the local `fake-indexeddb` dependency is not installed in this environment. This is an environment limitation, not an application test failure.

## Required Visual Studio browser checks

1. Open Customers and confirm Email is one normal field, with no detached or narrow prefix box.
2. Enter an 11-digit formatted phone number and confirm it remains fully visible.
3. Open Quotes and confirm Service Address appears above City/State/ZIP and before Phone/Email.
4. Confirm Scope of Work / Notes is one field and Estimated Amount/Frequency are stacked beside it on desktop.
5. Load an older quote containing both scope and notes and confirm both appear in the consolidated field.
6. Confirm Quote, Customer, and Invoice contact-action cards remain large and touch friendly.
7. Open Communications and verify recipient action buttons match each other in size and style.
8. Verify Home, Scheduling, Weather, History, and Alerts still open and behave as before.
9. Generate Quote and Invoice PDFs and confirm no data fields were lost.
10. Test at desktop, tablet, and phone widths.
