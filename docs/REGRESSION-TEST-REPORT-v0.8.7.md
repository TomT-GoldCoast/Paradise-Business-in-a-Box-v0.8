# Regression Test Report - v0.8.9

Routing correction release.

## Routing defect reproduced

The prior Route Center combined every non-completed/non-cancelled job across future dates into a single route. In the canonical Training Mode dataset this meant 21 open jobs across 14 service dates were chained together. The dashboard route preview used the same all-open-job behavior despite being labeled as today's route.

## Correction

- Route Center filters stops to one selected service date.
- Route Date selector defaults to today when open jobs exist, otherwise the next open service date.
- Dashboard route preview uses only today's open jobs.
- Current device origin participates in route recommendation when enabled.
- OSRM remains the road-network provider; recommendations do not silently modify scheduled appointments.

## Test result

17 automated suites passed, including routing-daily, responsive-layout, provider-contracts, authentication/isolation, billing, backup/restore, Training Mode, and public UI regression.
