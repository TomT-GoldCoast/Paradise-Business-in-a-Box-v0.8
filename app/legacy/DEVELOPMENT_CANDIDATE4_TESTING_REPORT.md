# Paradise Lawn Care v3.21B - Development Candidate 4

## Invoice layout correction

- Tax and Payment Method remain stacked in the left card.
- Notes now sits below those controls in the same left card.
- Financials occupies the right card with dedicated Subtotal, Tax, and Total rows.
- Payment Link now sits inside Financials beneath the amounts.
- Both cards use the same stretch behavior and consistent internal spacing.
- The finance row collapses to one column on smaller screens.
- Pictures, Damages & Signed Invoice now uses three balanced upload cards for Before Photos, After Photos, and Other Documents.
- Existing attachment IDs and handlers were preserved.

## Validation completed

- JavaScript syntax check passed.
- Duplicate HTML ID check passed.
- Notes field exists once.
- Existing attachment input IDs remain intact.
- Payment Link remains available to saved invoices and PDF preview logic.

## Browser acceptance checks

1. Open Invoice and confirm the left and right finance cards are even and do not overlap.
2. Add a taxable service and verify Subtotal, Tax, and Total update.
3. Enter a Payment Link, save, reopen, and preview the PDF.
4. Add Before Photos, After Photos, another picture, a damage report, and a signed invoice.
5. Confirm the attachment gallery and PDF preview still label and display the files correctly.
6. Check desktop, tablet, and phone widths.
