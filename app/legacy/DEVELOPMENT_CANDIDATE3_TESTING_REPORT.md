# Paradise Lawn Care v3.21B - Development Candidate 3

## Changes included

- Automatic formatting for 10-digit and US 11-digit telephone numbers throughout the application.
- Invoice Tax and Payment Method are stacked on the left; Financials are positioned on the right with consistent spacing.
- Added a Payment Link field to the invoice and invoice PDF preview.
- Added separate Before Photos and After Photos upload actions.
- Before, after, additional property, and damage photos are included in the invoice PDF preview when available.
- Scheduling employee/crew choices are BP, E1, E2, and E3. RS was removed from visible choices; legacy RS data displays as E1.
- Empty schedule record fields use smaller text; populated records are larger and clickable.
- Clicking a populated scheduled record opens its related Invoice or Quote.
- The Selected Record card now emphasizes Customer Name and a numeric Account Number; internal schedule/job identifiers remain hidden for record integrity.

## Document sharing note

The application prepares the invoice document and recipient information. Web browsers do not consistently permit an application to force a PDF attachment into every device's email or text client. PDF preview, printing/saving, recipient preparation, photos, and payment-link display are wired. Final attachment behavior must be verified on the actual phone/tablet and email or messaging application used in production.

## Automated validation

- `node --check script.js`: passed.
- Focused Candidate 3 and existing regression checks: 22 passed, 0 failed.
- Complete demo suite checks: passed.
- The full simulated-browser suite remains unavailable in this environment because `fake-indexeddb` is not installed.

## Browser acceptance checklist

1. Enter 10 digits in Customer, Quote, and Invoice phone fields and verify `(000) 000-0000` formatting.
2. Enter an 11-digit US number beginning with 1 and verify `1 (000) 000-0000` formatting.
3. Save and reopen an invoice with a Payment Link; confirm it appears in the PDF preview.
4. Add Before and After photos; open the PDF preview and confirm labeled photo sections.
5. Confirm Tax and Payment Method are stacked left and Financials are right on desktop, then stack cleanly on mobile.
6. Confirm schedule employee choices are BP, E1, E2, and E3 only.
7. Select a schedule record and confirm Customer Name plus numeric Account Number display.
8. Click a scheduled Invoice/Quote field and confirm the linked record opens.
9. Verify empty schedule fields use smaller placeholder text and populated fields use larger text.
10. Recheck Customer, Quote, Invoice, Scheduling, PDF, demo install, and demo delete workflows.
