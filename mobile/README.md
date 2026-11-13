# Lakaz frontend

**Owners:** Fahim and Zuhayr · **Branch:** `feat/mobile`

Expo, React Native and TypeScript. See the [shared handoff](../docs/handoff.md) and [main README](../README.md).

Owners: document the exact install and run steps, phone test client, environment variable names, screen navigation, shared theme and components, and how to test with sample versus live events.

## Run locally

Clone the repo into a local folder outside OneDrive. From the repo root:

```sh
cd mobile
npm ci
npm run web
```

Open the localhost URL Expo prints and add `/signup` (usually `http://localhost:8081/signup`). A fresh checkout uses the shared Lakaz Supabase project with its publishable key. If you already have a `mobile/.env` with blank Supabase overrides, remove those two blank lines and restart Expo.

Create an account with your email, enter the code from your inbox, then log in with your Lakaz password. **Forgot password** sends a separate recovery code. New accounts see band alerts after a project admin links them to a band. See the [backend account setup](../backend/README.md#carer-accounts-and-email).

The Alerts tab reads live help requests. The GPS, safe-zone and device-status demonstrations still use sample data. To try the sample account flow, set both Supabase variables in `.env.example` to empty values in a local `.env`.

## AI tools used
- OpenAI Codex: added the safety history filters and acknowledgement display.
- Claude Code (with the ui-ux-pro-max skill): built the screens, theme, mock data layer and responder page. The owners review every file.
- Claude Code also built the district health-facility lookup (`src/app/facilities.tsx`, `src/data/facilities.ts`) on Shihad's `public.facilities` table; tested against the live Supabase data.
