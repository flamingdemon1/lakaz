# Lakaz frontend

**Owners:** Fahim and Zuhayr · **Branch:** `feat/mobile`

Expo, React Native and TypeScript. See the [shared handoff](../docs/handoff.md) and [main README](../README.md).

Owners: document the exact install and run steps, phone test client, environment variable names, screen navigation, shared theme and components, and how to test with sample versus live events.

## Run it (Zuhayr, 13 Nov)

> **Do not run the app from the OneDrive folder.** Metro can't see `src/app` there, and you get the "Welcome to Expo" page. Clone the repo to a folder like `C:\dev\lakaz` instead.

```bash
cd mobile
npm install
copy .env.example .env     # set EXPO_PUBLIC_API_URL to the laptop IP; USE_MOCK=true for simulated data
npx expo start --lan       # scan the QR code with Expo Go (same hotspot); press w for web
```

- Screens: `/login` (demo login), Home, Alerts, Band, `/alert/[id]` (ladder + map + "I've got it"), `/responder` (community page for the QR code, web).
- Mock mode (`EXPO_PUBLIC_USE_MOCK=true`): SIMULATED data with demo buttons; the ladder uses the 10 s / 25 s / 45 s timers. Everything simulated is labelled in purple.
- Live mode: REST `/api/alerts`, `/api/devices/band-01/status`, `/api/devices`, and Socket.IO `status:update`, `alert:new`, `alert:update`.
- Theme: `src/theme.ts` (colours are placeholders). Maps: `LocationMap.tsx` (phone) and `LocationMap.web.tsx` (Leaflet).

## AI tools used
- Claude Code (with the ui-ux-pro-max skill): built the screens, theme, mock data layer and responder page. The owners review every file.
