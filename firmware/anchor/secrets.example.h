// Copy this file to secrets.h in the same folder and fill it in.
// secrets.h is gitignored: never commit Wi-Fi passwords.
#pragma once

#define WIFI_SSID   "your-hotspot"     // 2.4 GHz hotspot
#define WIFI_PASS   "your-password"

// Optional laptop test server (simulator/mock.js) that drives the status LED.
// Leave "" and the anchor is a plain home beacon.
#define STATUS_URL  ""                 // e.g. "http://192.168.43.20:3000/api/devices/band-01/status"
