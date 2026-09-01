# Regression Test Report — v0.8.3

Scope: Training Mode isolation, clean production data, QuickBooks integration capability, retained authentication/backup/billing behavior, and legacy served-app cleanup.

The package test command is `npm run test:all`. It includes the pre-existing regression suites plus `training-quickbooks.mjs`, which verifies production starts empty, training exposes exactly 20 fictional accounts, the 20- and 5-property portfolios exist, production data is invisible in training, training data disappears when returning to production, and QuickBooks sync is blocked from training.
