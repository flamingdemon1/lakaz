// Lakaz band (ESP32 #2)
// - Double click         -> SOS: help_requested sent to Supabase (docs/handoff.md), carer sees it in the app
// - Single click         -> I'M OK: stops the buzzer
// - Leaves the home beacon -> buzzer beeps every second until back home or a short press
// Wiring: Button D32 <-> GND (the board's BOOT button also works) | Buzzer module I/O->D33, VCC->3V3, GND->GND
// Libs: NimBLE-Arduino 2.x, ArduinoJson 7. Board: ESP32 Dev Module, Partition Scheme: Huge APP.
// Setup: copy secrets.example.h to secrets.h and fill it in (secrets.h is gitignored).
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <NimBLEDevice.h>
#include <ArduinoJson.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "secrets.h"

// Second Wi-Fi (optional): a phone hotspot carried WITH the band, so it stays online away from home.
// Why: the home hotspot stays at home, so leaving home also meant losing Wi-Fi and every left_home / SOS
// waited in the queue until the band came back. Older secrets.h files without these still compile.
#ifndef WIFI2_SSID
#define WIFI2_SSID ""
#define WIFI2_PASS ""
#endif

// Which network the band tries next: 0 = WIFI_SSID (home), 1 = WIFI2_SSID (travelling phone hotspot).
int wifiNet = 0;
bool hasWifi2() { return strlen(WIFI2_SSID) > 0; }

// Starts joining one network (non-blocking). The loop switches network if it doesn't connect.
void wifiJoin(int net) {
  WiFi.disconnect();
  if (net == 1 && hasWifi2()) WiFi.begin(WIFI2_SSID, WIFI2_PASS);
  else WiFi.begin(WIFI_SSID, WIFI_PASS);
}

#define ANCHOR_NAME "LAKAZ-ANCHOR"
#define RSSI_HOME   -70        // stronger than this for HOME_MS = home
#define RSSI_AWAY   -80        // weaker than this (or not heard) for AWAY_MS = away
#define HOME_MS     3000
#define AWAY_MS     8000
#define BTN         32         // external button to GND
#define BTN_BOOT    0          // BOOT button on the board: backup button
#define BUZ         33         // buzzer module I/O (low-level trigger: LOW = sound)
#define DOUBLE_MS   500        // second click within this = double click (SOS)

NimBLEScan* scan;
volatile int anchorRssi = -127;
volatile unsigned long anchorSeenAt = 0;
volatile bool anchorEverSeen = false;

// ---- BLE: listen for the anchor's beacon ----
class ScanCB : public NimBLEScanCallbacks {
  void onResult(const NimBLEAdvertisedDevice* d) override {
    if (d->getName() == ANCHOR_NAME) { anchorRssi = d->getRSSI(); anchorSeenAt = millis(); anchorEverSeen = true; }
  }
} scanCB;

int currentRssi() { return (anchorEverSeen && millis() - anchorSeenAt < 3000) ? anchorRssi : -127; }

// ---- buzzer ----
void buzzerOn()  { pinMode(BUZ, OUTPUT); digitalWrite(BUZ, LOW); }
void buzzerOff() { pinMode(BUZ, OUTPUT); digitalWrite(BUZ, HIGH); }

// non-blocking patterns: on/off ms alternating, 0 = end
const uint16_t P_AWAY[] = {300, 700, 0};   // beep every second while away
const uint16_t P_SOS[]  = {2000, 0};       // long tone
const uint16_t* pat = nullptr;
bool patLoop = false;
int patIdx = 0;
unsigned long patAt = 0;

void buzz(const uint16_t* p, bool loop = false) { pat = p; patLoop = loop; patIdx = 0; patAt = millis(); buzzerOn(); }
void stopBuzz() { pat = nullptr; buzzerOff(); }
void buzzTick() {
  if (!pat || millis() - patAt < pat[patIdx]) return;
  patIdx++; patAt = millis();
  if (pat[patIdx] == 0) {
    if (!patLoop) { stopBuzz(); return; }
    patIdx = 0;
  }
  if (patIdx % 2 == 0) buzzerOn(); else buzzerOff();
}

// ---- events to Supabase: {"event_id": <uuid v4>, "kind": "help_requested" | "left_home" | "back_home"} ----
// The function accepts exactly these two keys. A retry reuses the same event_id,
// so the backend stores one row per press / departure / return.
struct Pending { char id[37]; char kind[16]; };
Pending pending[5];
int pendingCount = 0;

void newUuid(char* out) {
  uint8_t b[16];
  for (int i = 0; i < 16; i += 4) { uint32_t r = esp_random(); memcpy(b + i, &r, 4); }
  b[6] = (b[6] & 0x0F) | 0x40;   // version 4
  b[8] = (b[8] & 0x3F) | 0x80;   // RFC 4122 variant
  snprintf(out, 37, "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
           b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]);
}

// Returns the HTTP status, or a negative number when the request never reached the server.
int postEvent(const char* eventId, const char* kind) {
  if (WiFi.status() != WL_CONNECTED) return -1;
  WiFiClientSecure tls;
  tls.setInsecure();   // shortcut: no certificate check; upgrade: tls.setCACert(<Supabase root CA>)
  HTTPClient http;
  if (!http.begin(tls, HELP_URL)) return -2;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " DEVICE_TOKEN);
  http.setTimeout(8000);
  char body[96];
  snprintf(body, sizeof body, "{\"event_id\":\"%s\",\"kind\":\"%s\"}", eventId, kind);
  Serial.println(body);
  int code = http.POST((uint8_t*)body, strlen(body));
  if (code > 0) Serial.printf("   server replied %d: %s\n", code, http.getString().c_str());   // backend's JSON, never the token
  else          Serial.printf("   no reply: %s\n", http.errorToString(code).c_str());
  http.end();
  return code;
}

// true = finished (delivered or permanently rejected); false = try again later
bool deliver(const char* eventId, const char* kind) {
  int code = postEvent(eventId, kind);
  if (code == 200) { Serial.printf("   %s delivered: carer app will show it\n", kind); return true; }
  if (code == 401) { Serial.println("   REJECTED 401: check DEVICE_TOKEN in secrets.h"); return true; }
  if (code >= 400 && code < 500) { Serial.printf("   REJECTED %d: request format\n", code); return true; }
  Serial.printf("   not delivered (%d), retrying with the same event_id\n", code);
  return false;
}

// Sends one event now; if it can't get through, queues it and retryHelp() resends it (same event_id).
void sendEvent(const char* kind) {
  char id[37];
  newUuid(id);
  if (deliver(id, kind)) return;
  if (pendingCount < 5) {
    strcpy(pending[pendingCount].id, id);
    strncpy(pending[pendingCount].kind, kind, sizeof pending[0].kind - 1);
    pending[pendingCount].kind[sizeof pending[0].kind - 1] = '\0';
    pendingCount++;
  } else Serial.println("   too many unsent events; this one is dropped");
}

void requestHelp() { sendEvent("help_requested"); }

void retryHelp() {
  if (!pendingCount || !deliver(pending[0].id, pending[0].kind)) return;
  for (int i = 1; i < pendingCount; i++) pending[i - 1] = pending[i];
  pendingCount--;
}

// ---- optional laptop test server (simulator/mock.js): home/away for the anchor LED ----
void tellLaptop(const char* type) {
  if (!strlen(LAPTOP_URL) || WiFi.status() != WL_CONNECTED) return;
  JsonDocument d;
  char id[37];
  newUuid(id);
  d["device_id"] = "band-01"; d["event_id"] = id; d["type"] = type;
  d["lat"] = nullptr; d["lng"] = nullptr; d["gps_fix"] = false;
  d["home_rssi"] = currentRssi(); d["battery_pct"] = nullptr;
  String body;
  serializeJson(d, body);
  HTTPClient http;
  http.begin(LAPTOP_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", LAPTOP_KEY);
  http.setTimeout(2000);
  http.POST(body);
  http.end();
}

// ---- button: single click = I'M OK (stops buzzer), double click = SOS ----
bool buttonPressed() { return digitalRead(BTN) == LOW || digitalRead(BTN_BOOT) == LOW; }

void sos() {
  buzz(P_SOS);
  Serial.println(">>> SOS: help requested");
  requestHelp();
  tellLaptop("sos");
}

void buttonTick() {
  static bool down = false;
  static unsigned long lastChange = 0, firstClickAt = 0;
  static int clicks = 0;
  bool pressed = buttonPressed();
  if (pressed != down && millis() - lastChange > 40) {        // 40 ms debounce
    lastChange = millis(); down = pressed;
    if (!pressed) {                                           // a click = press + release
      clicks++;
      if (clicks == 1) firstClickAt = millis();
      if (clicks == 2) { clicks = 0; sos(); }                 // second click inside the window
    }
  }
  if (clicks == 1 && !down && millis() - firstClickAt > DOUBLE_MS) {   // no second click came
    clicks = 0;
    stopBuzz();
    Serial.println(">>> I'M OK (buzzer stopped)");
    tellLaptop("ok_pressed");
  }
}

void setup() {
  // shortcut: brownout reset off. USB power dips when Wi-Fi starts and rebooted the band
  // every 2-3 s. Upgrade: a stronger 5 V supply, then remove this line.
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  buzzerOn(); delay(400); buzzerOff();   // START BEEP: band switched on
  Serial.begin(115200);
  pinMode(BTN, INPUT_PULLUP);
  pinMode(BTN_BOOT, INPUT_PULLUP);
  Serial.println("\n===== LAKAZ BAND =====");

  WiFi.persistent(false);               // no flash writes (safe with brownout reset off)
  WiFi.mode(WIFI_STA);
  wifiJoin(0);
  WiFi.setTxPower(WIFI_POWER_8_5dBm);   // lower current spikes; hotspot is close by
  while (WiFi.status() != WL_CONNECTED && millis() < 10000) delay(250);
  // Home Wi-Fi not there at boot (e.g. switched on outside): try the travelling hotspot.
  if (WiFi.status() != WL_CONNECTED && hasWifi2()) {
    wifiNet = 1; wifiJoin(1);
    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) delay(250);
  }
  if (WiFi.status() == WL_CONNECTED) Serial.printf("WiFi: connected to %s\n", WiFi.SSID().c_str());
  else Serial.println("WiFi: not connected (events will queue and retry)");

  NimBLEDevice::init("");
  scan = NimBLEDevice::getScan();
  scan->setScanCallbacks(&scanCB, true);   // true = keep reporting the anchor
  scan->setActiveScan(true);
  scan->setInterval(100);
  scan->setWindow(50);                     // 50% duty leaves radio time for Wi-Fi
  scan->start(0, false, true);             // 0 = scan forever
  Serial.println("Ready. Listening for the home beacon...\n");
}

void loop() {
  buzzTick();
  buttonTick();
  if (!scan->isScanning()) scan->start(0, false, true);

  static bool home = true;
  static unsigned long strongSince = 0, weakSince = 0, lastRetry = 0, lastPrint = 0;
  unsigned long now = millis();
  int rssi = currentRssi();

  // Home/away is only judged once the anchor has been heard: an unpowered anchor must not make the band scream.
  if (anchorEverSeen) {
    if (rssi >= RSSI_HOME) { if (!strongSince) strongSince = now; } else strongSince = 0;
    if (rssi <  RSSI_AWAY) { if (!weakSince)   weakSince   = now; } else weakSince   = 0;
    if (!home && strongSince && now - strongSince >= HOME_MS) {
      home = true; stopBuzz();
      Serial.println(">>> BACK HOME (buzzer off)");
      sendEvent("back_home");   // Supabase: app shows "back home"
      tellLaptop("back_home");
    }
    if (home && weakSince && now - weakSince >= AWAY_MS) {
      home = false; buzz(P_AWAY, true);
      Serial.println(">>> LEFT HOME (buzzer on, short press stops it)");
      sendEvent("left_home");   // Supabase: app shows the "Left home" takeover
      tellLaptop("left_home");
    }
  }

  // No Wi-Fi (left home, or the iPhone hides its hotspot until the Personal Hotspot screen is open): keep
  // trying, alternating home Wi-Fi and the travelling hotspot every 6 s until one connects. Non-blocking,
  // so the buzzer and the button keep working. Queued events go out by themselves once connected.
  static unsigned long lastWifiTry = 0;
  if (WiFi.status() != WL_CONNECTED && now - lastWifiTry >= 6000) {
    lastWifiTry = now;
    if (hasWifi2()) wifiNet = 1 - wifiNet;
    wifiJoin(wifiNet);
    Serial.printf("   trying wifi: %s\n", wifiNet == 1 && hasWifi2() ? WIFI2_SSID : WIFI_SSID);
  }

  if (now - lastRetry >= 5000) { lastRetry = now; retryHelp(); }
  // No heartbeat (team decision): the band only sends real events, so "online" is not reported between them.

  if (now - lastPrint >= 2000) {
    lastPrint = now;
    const char* state = !anchorEverSeen ? "WAITING FOR HOME BEACON" : (home ? "AT HOME" : "LEFT HOME");
    // wifi code: 1 = hotspot not found, 4 = wrong password / refused, 6 = disconnected (retrying)
    if (WiFi.status() == WL_CONNECTED) Serial.printf("%s | signal %d | wifi ok (%s)%s\n", state, rssi, WiFi.SSID().c_str(), pendingCount ? " | unsent events queued" : "");
    else Serial.printf("%s | signal %d | no wifi (code %d)%s\n", state, rssi, WiFi.status(), pendingCount ? " | unsent events queued" : "");
  }
}
