# Business in a Box v0.3.0 Architecture

## Current prototype

```text
Public Business Website ─┐
Owner / Office Web App ──┼── HTTP API ── Domain Rules ── Storage Adapter ── JSON demo store
Crew Web Experience ─────┤
Customer Portal ─────────┘
```

The JSON store is intentionally replaceable. The UI does not access the file directly.

## Production target

```text
Custom Domains / Tenant Websites
             │
Authenticated Role-based Web Application
             │
        API / Auth Layer
             │
 Domain Services + Workflow Engine
             │
 PostgreSQL + Object Storage + Queue/Events
             │
 Provider Adapters
 Payments | Email/SMS | Maps | Accounting | AI | Weather
```

## Source layout

- `app/` role-aware business application.
- `website/` connected public tenant website.
- `server/server.mjs` HTTP routes and orchestration.
- `server/lib/domain.mjs` reusable business rules and integrity helpers.
- `server/lib/storage.mjs` persistence adapter.
- `server/data/seed.json` canonical demo seed.
- `server/data/demo.json` mutable local test data.
- `tests/` automated API and workflow checks.
- `docs/CONSTITUTION.md` governing product rules.

## Tenant boundary

v0.3.0 demonstrates one tenant, Paradise Lawn Care. The data structures are tenant-configurable, but full multi-tenant authentication/database row isolation is intentionally deferred until the cloud database phase. A production tenant ID must be carried through authentication and every persisted entity.
