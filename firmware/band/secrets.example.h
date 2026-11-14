// Copy this file to secrets.h in the same folder and fill it in.
// secrets.h is gitignored: never commit Wi-Fi passwords or the device token.
#pragma once

#define WIFI_SSID     "your-hotspot"     // home Wi-Fi, 2.4 GHz
#define WIFI_PASS     "your-password"

// Second network: the phone carried with the band, so alerts still go out away from home.
// iPhone: Personal Hotspot + "Maximise Compatibility" (= 2.4 GHz). Android: hotspot band 2.4 GHz.
// Leave WIFI2_SSID "" to use only the home network.
#define WIFI2_SSID    ""
#define WIFI2_PASS    ""

// Supabase device-event function (backend/supabase/functions/device-event).
// Project URL from Shihad; device token issued by the backend team, never shared in chat or Git.
#define HELP_URL      "https://<project-ref>.supabase.co/functions/v1/device-event"
#define DEVICE_TOKEN  "<device-token>"

// Optional laptop test server (simulator/mock.js) for home/away status and the anchor LED.
// Leave "" to switch it off.
#define LAPTOP_URL    ""                 // e.g. "http://192.168.43.20:3000/api/events"
#define LAPTOP_KEY    "demo-key"         // must match KEY in simulator/mock.js
