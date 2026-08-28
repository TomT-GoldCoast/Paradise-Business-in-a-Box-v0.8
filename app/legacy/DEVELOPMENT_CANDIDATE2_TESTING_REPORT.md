# Paradise Lawn Care v3.21B Development Candidate 2

## Finder Row Layout Correction

This update adjusts the existing Customer Finder and Saved Quotes rows to accommodate the complete demo data without redesigning the workflow.

### Customer Finder
- Increased each result row height.
- Uses two clean information lines.
- First line: customer name and account number.
- Second line: contact information, location when available, and property count.
- Prevents character-by-character wrapping and text overlap.
- Entire row remains clickable.

### Saved Quotes
- Increased each quote row height.
- First line: quote number, customer name, and amount.
- Second line: account number, status, and a one-line scope/frequency summary.
- Long descriptions are safely truncated with an ellipsis instead of overlapping another record.
- Entire row remains clickable.

### Responsive behavior
- Rows expand naturally when the viewport narrows.
- Amounts and account chips remain readable.
- On small screens, summaries move to their own line.

## Validation
- `node --check script.js`: passed.
- Complete demo-suite focused checks: passed.
- All available focused tests: 36 passed.
- The full simulated-browser test remains blocked because the local environment does not contain the `fake-indexeddb` package required by `tests/app.test.js`.

## Browser acceptance checks
1. Install the Complete Demo Suite.
2. Open Customers and verify every finder result is readable without overlap.
3. Search by name, phone, city, and account number.
4. Open Quotes and verify every saved quote is readable without overlap.
5. Confirm long scope descriptions end with an ellipsis rather than crossing into another record.
6. Test standard desktop, narrow desktop/tablet, and phone-width views.
7. Click several customer and quote rows to confirm the original load workflow remains unchanged.
