# Lakaz backend

**Powered to Protect · Owners: Shihad and Inshiraah · Integration branch: `feat/backend`**

The ESP32 sends a help request; Supabase stores it; the linked carer sees and acknowledges it; the acknowledgement stays saved after refresh. Stack: Supabase/PostgreSQL (SQL), with TypeScript for the Supabase Edge Function. See the [main README](../README.md) and [team handoff](../docs/handoff.md). The shared Supabase project has both migrations applied and the device endpoint deployed.

## Interface to agree before coding

- **Device intake:** Proposed `POST /functions/v1/device-event` over HTTPS. The device sends a unique `event_id` and `kind: "help_requested"`. The function validates a dedicated device credential, resolves the device server-side and records server time. Retrying the same device/event pair must return the existing event without creating another.
- **Carer read:** An authenticated, linked carer receives the event ID, kind, received timestamp and nullable acknowledgement timestamp. Give Fahim and Zuhayr a sample in the agreed shape so the app can be built in parallel.
- **Carer acknowledgement:** The backend verifies the signed-in carer is linked to the event, records the server timestamp and returns the updated event. A retry must not reset the original timestamp.
- **Local data:** Later, expose a read-only district-filtered facility lookup using verified Mauritian records. Record the source, extraction date and reuse terms in the main README. Keep the lookup separate from the alert so it cannot break the core flow.

## Split the work

| Owner | Branch | Files owned | First result |
|---|---|---|---|
| Shihad + Codex | `feat/backend-ingest` | `backend/supabase/functions/device-event/` | Send a sample device request to the deployed function; verify one stored row and no duplicate on retry. Coordinate the real ESP32 request with Kavish. |
| Inshiraah + Gemini | `feat/backend-db` | `backend/supabase/migrations/` | Create device/carer links, events, access policies and acknowledgement logic. Prove a linked carer can acknowledge and a second account cannot read or acknowledge. |

Agree the table and function names, input/output, and fixture IDs together first. Shihad can build request validation against a sample payload while Inshiraah builds SQL independently. Use separate branches from `feat/backend`, commit verified changes on each, then merge the database changes before deploying the intake function. Coordinate edits to this README and the shared handoff.

## Setup and security

1. Use a team-owned Supabase project and test accounts. Record exact migration and function deployment commands after the first successful setup.
2. Document variable **names only** in `.env.example` where applicable. The app gets the Supabase URL and publishable key; privileged credentials stay server-side. Keep device tokens and Wi-Fi credentials out of Git, the app and logs.
3. Enable row-level security on exposed tables. Allow only linked carers to read events. Use a narrow acknowledgement operation; do not grant carers general updates to event rows. The device uses its own credential, separate from carer sign-in.
4. Share the confirmed endpoint and a redacted request example with Kavish. Share the confirmed response and acknowledgement interface with the mobile pair. Keep sample records clearly labelled.

## Verification and commits

- Valid sample device request creates one event; retry creates no extra row; invalid credential and malformed request are rejected.
- Linked carer sees and acknowledges the event; the acknowledgement survives refresh; a different carer cannot read or acknowledge it.
- Run the same flow from the real ESP32 on the demo phone. Record hardware versus sample results separately.
- Commit small, meaningful checkpoints: docs, database and policies, intake, and integrated verification. Write what was tested in each PR; do not claim checks that have not run.
- Record Codex and Gemini's actual uses in the main README. Once the surprise card is drawn, update the shared handoff if the interface changes and record how to prove compliance.

## Mauritian healthcare facility lookup

Source: [Open Data Mauritius healthcare facility locations CSV](https://data.govmu.org/dataset/locations-hospitals-clinics-medi-clinics-area-health-centres-and-community-health-centres) (Mauritius Digital Promotion Agency; [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); portal last updated 30 September 2024, checked 13 November 2026).

The [new migration](supabase/migrations/20261113180000_create_facilities.sql) imports 169 facilities across nine districts. It selects facility name, institution type and district, trims whitespace and sorts rows. It omits contact details and coordinates. The dataset does not verify current services or opening hours.

The signed-in app reads `public.facilities` fields `id, name, type, district, source_url` and filters by exact `district`: Black River, Flacq, Grand Port, Moka, Pamplemousses, Plaines Wilhems, Port Louis, Riviere du Rempart, Savanne. Client writes are disabled. This directory does not route alerts to facilities.

After review, apply the new migration once to Lakaz. It leaves the alert tables alone. Local checks matched every seed row to the CSV and found 14 Moka and 32 Plaines Wilhems records. The shared project contains all 169 rows. Zuhayr verified signed-in browser lookup for Moka (14), Plaines Wilhems (32) and Flacq (30). Direct unauthenticated and write checks remain pending.

## Live Supabase checkpoint — 13 November 2026

- Deployed `device-event` to the shared Lakaz Supabase project from `backend/` with `npx supabase functions deploy device-event --remote=<project-ref>`.
- A sample request with no device token returned HTTP 401 (`unauthorized`).
- Two requests with the same registered test device and event UUID both returned HTTP 200. The Supabase Table Editor showed exactly one matching help alert, with acknowledgement still empty.
- These were Command Prompt sample requests. Pending: have the linked test carer acknowledge the alert in the app, refresh to verify persistence, check access with an unlinked account, and repeat with the physical ESP32.
