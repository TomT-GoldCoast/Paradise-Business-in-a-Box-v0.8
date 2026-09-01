# Paradise Combo Web and App v0.8.3 Regression Test Report

Release candidate regression pass completed after the v0.8.3 estimate-photo, service-catalog and product-identity completion changes.

## Result

All 14 automated suites passed:

1. smoke
2. workflow
3. quote-routing
4. public-ui-regression
5. visual-contract
6. attachments
7. tenant-branding
8. backup-restore
9. provider-contracts
10. parity-upgrade
11. auth-backup-upgrade
12. auth-isolation
13. training-quickbooks
14. release-v083

## v0.8.3 release-specific assertions

- Production and Training use the same 13-service catalog.
- Website estimate intake exposes the same approved service list.
- The excluded pressure-service wording is absent from application/service content.
- Estimate request contains exactly four Front Yard and four Back Yard image upload slots.
- Website client collects at most eight estimate images and the server independently caps intake at eight images.
- Estimate photos are stored with the lead and can be viewed in the app lead workflow.
- The prior visible product wording is absent.
- App identity and lower-left footer use `Combo Web and App`.
- Production seed contains zero customer/demo records.
- Production seed contains no pre-created Owner password hash; first-run Owner setup remains required.
- Training Mode, role isolation, QuickBooks isolation, backup/restore, billing parity and tenant branding regression tests remain green.

## Release hygiene

After the regression run, `production.json` was restored from the clean production seed, `training.json` was restored from the canonical training seed, and test-generated hosted backup snapshots were removed before packaging.
