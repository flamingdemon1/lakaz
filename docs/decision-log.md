# Decision log

Times below are the evidence commits converted to Mauritius time (UTC+4). They record when a decision appeared in git, rather than an inferred discussion time.

| Date/time (MUT) | Decision | Why / evidence | Owner |
|---|---|---|---|
| 2026-11-13 20:10:38 | Use Supabase Postgres, RLS and one device Edge Function | Database, intake and app integration; help-button contract in docs/handoff.md; commit `8f97e40` | Backend team / Fahim |
| 2026-11-13 19:50:07 | Use the official Open Data Mauritius facility dataset | 169 records, CC BY-SA 4.0; facilities migration; commit `e7394fb` | Fahim / backend team |
| 2026-11-13 20:58:00 | Prove It Works through a persistent acknowledgement receipt | Surprise card; PR #17. Acknowledge → receipt → refresh → reopen with same server timestamp; commit `5d1e143` | Zuhayr |
| 2026-11-13 20:49:00 | Cut WhatsApp, low battery and band-removed alerts | c95e8f1 and a93aa6f remove unsupported channels and band readings; commit `c95e8f1` | Zuhayr |
| 2026-11-13 21:11:47 | Use email accounts and cut phone-code login | Supabase Auth email integration; phone login requires an SMS provider; commit `ab9875d` | Fahim |
| 2026-11-14 00:03:25 | Use Night glow and EN/FR/Kreol across the app | PR #19; dark UI and language system; commit `668a3d4` | Zuhayr |
| 2026-11-14 01:20:01 | Use real open → acknowledged → resolved help alerts | PR #24; PR #22 adds acknowledgement identity, band labels and band linking; commit `86fe500` | Zuhayr |
| 2026-11-14 01:23:06 | Keep help intake successful even when heartbeat fails | PR #23 adds wearer details and heartbeat; alert saved before best-effort timestamp update; commit `358b133` | Fahim |
| 2026-11-14 01:24:05 | Label GPS and wandering demonstrations as simulated | PR #25 source line says no GPS on band; live help status and heartbeat are separate; commit `1d351b2` | Zuhayr / Fahim |
| 2026-11-14 02:29:34 | Removed the band heartbeat; band status from real events | PR #32 (88df5fc) and PR #33 (cf0b26e); timestamp from #33 merge commit | Kavish / Fahim |
| 2026-11-14 02:16:15 | Left home / back home through Supabase instead of a laptop server | PR #30 (d341e3d), PR #31 (3ce1493); timestamp from #31 merge commit | Shihad / Zuhayr |
| TODO time | Phone GPS as a demo stand-in for band GPS, disclosed to judges | Team decision, 14 Nov 2026. The band has no GPS; integration must be checked on a real phone | Team |
