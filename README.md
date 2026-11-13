# Lakaz

**Life Powered by Tech · Middlesex University Mauritius · 13–14 November 2026**
**Theme:** Powered to Protect — trusted-contact alerts and support for people at risk.
**Status:** Kick-off documentation. App, firmware, dataset integration and demo are not yet verified.

## Problem and user

Our first user is a family carer in Mauritius who checks in on an older relative living independently. The wearer needs a simple way to ask for help without navigating a phone. The carer needs to see that request and acknowledge it so the response is recorded. Start with one wearer and one authorised carer. The prototype does not diagnose conditions or dispatch emergency services.

## What we are building

Press a button on the ESP32 → send an authenticated event → save it in Supabase → display it in the carer’s app → save the carer’s acknowledgement → verify it survives a refresh. Show the real hardware event in the live demo. Clearly label any simulated fallback; sample events are useful while the teams work in parallel.

## Real Mauritian data

Candidate: [Ministry of Health and Wellness, Family Planning and Demographic Yearbook 2024, Appendix I.4](https://health.govmu.org/health/wp-content/uploads/2026/02/YEARBOOK-2024-1.pdf). Use actual facility names, types and districts to power a district-filtered facility lookup from the alert screen. The carer picks a district; no GPS or medical routing needed. Do not infer current opening hours or availability. Record source page, extraction date, cleaning decisions and reuse terms before publishing extracted data. If terms are unclear, link to the source and confirm a reusable alternative. A live ESP32 event does not replace the requirement for a real local dataset powering an app feature.

## Stack and team

| Owners | Branch | Languages and tools | Responsibility |
|---|---|---|---|
| Fahim + Zuhayr | `feat/mobile` | TypeScript, React Native, Expo, VS Code, phone testing | App screens, shared theme and components, alerts, acknowledgement and facility lookup |
| Shihad + Inshiraah | `feat/backend` | SQL, PostgreSQL, Supabase dashboard; TypeScript if needed for a Supabase function | Event intake, database, access rules, acknowledgement and data import |
| Kavish | `feat/device-setup` | C++ with Arduino IDE, ESP32, Serial Monitor, Git/GitHub | Setup and configuration, device event path, integration checks and demo readiness |

Use GitHub as the shared source of truth. Agree on the [handoff](docs/handoff.md), then build against the same sample event. Push small checkpoints to your branch and share a screenshot or test result in the group. Merge a first real event early. Fahim and Zuhayr own the reference screen, theme and shared components; any other UI should reuse them. Ask Shihad before changing stack or adding a dependency.

## The three READMEs

| README | Owner | Purpose |
|---|---|---|
| [Main README](README.md) | Team | Project overview, stack, rules, demo and submission |
| [Backend README](backend/README.md) | Shihad + Inshiraah | Supabase setup, database, device API, access rules and verification |
| [Frontend README](mobile/README.md) | Fahim + Zuhayr | Expo setup, screens, shared theme and components, and phone testing |

The backend and frontend files are starters for their owners to complete as implementation lands.

## How to run

1. Clone this repo and switch to the branch you need. Install Git, Node.js/npm for the app, Arduino IDE and the ESP32 board support for firmware. Use a phone with the team’s chosen Expo test setup.
2. Once the mobile scaffold exists, run `npm ci` from its folder after a lockfile is committed, configure variables from its `.env.example`, then run `npx expo start`. Scan the QR with the chosen Expo test client.
3. Backend: apply the committed SQL migrations to the team’s Supabase project in order and configure the device endpoint and server-side secrets. Use a dedicated test wearer and carer. Backend owners must replace this line with the exact migration and deployment steps after the first successful run.
4. Firmware: open the committed sketch, select the team’s actual ESP32 board and serial port, set Wi-Fi and device credentials locally, upload and open Serial Monitor. Press the button and verify that the event appears in the app, then acknowledge and refresh.
5. Before submitting, update these steps with actual paths, board settings, and a tested APK or Expo/test link. Verify on a second phone/account.

Never commit Wi-Fi credentials, device tokens, privileged Supabase keys, real wearer data or private location history. The app uses only public client configuration with access rules enforced in Supabase.

## AI disclosure

| Tool used | What it was used for |
|---|---|
| OpenAI ChatGPT / Codex | Drafted the kick-off README, collaboration instructions, proposed interface and submission checklist; implemented and tested ESP32 request validation with sample events. |
| Anthropic Claude | Team tool; specific uses to be recorded by its users. |
| Google Gemini | Team tool; specific uses to be recorded by its users. |

Append actual uses as work happens, including code, UI, data cleaning or pitch assistance. Each teammate should be able to explain and change their own work in Q&A.

## Surprise card

**Status: not drawn.** Shihad records the exact wording and Mauritius time as soon as the card is drawn. The team agrees what must be added, removed or constrained, updates the affected owners and interface, and defines one visible check that proves compliance. Put the decision in the [log](docs/decision-log.md); update this section with what changed, how it was tested and where the judges will see it. Keep the core flow working and integrate the constraint before polishing optional features.

## Submission checklist

**Deadline: Saturday, 14 November 2026 at 12:30 MUT. Late submissions are not judged.**

- [ ] Public Git repo with commits from kick-off, submitted via the organisers’ Google Form.
- [ ] Android APK or Expo/test link, tested independently.
- [ ] Backup demo video, about two minutes, showing the core feature working.
- [ ] Pitch deck, maximum six slides.
- [ ] README covering problem, specific user, data sources, stack, AI use, surprise card and run steps.
- [ ] [Decision log](docs/decision-log.md) with 5–10 key decisions and actual times.
- [ ] Live demo with real data, a visible surprise-card check, and everyone ready to explain their contribution.

Pitch rehearsal: name the user and Mauritian problem; show the live alert and acknowledgement; show the dataset feature and card; explain who could run it, what it would cost, and how it would reach users. Label estimates, prototype limits and any fallback clearly.
