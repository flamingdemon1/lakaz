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

// ---- help request to Supabase: {"event_id": <uuid v4>, "kind": "help_requested"} ----
// The function accepts exactly these two keys. A retry reuses the same event_id,
// so the backend stores one alert per press.
char pendingHelp[5][37];
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
int postHelp(const char* eventId) {
  if (WiFi.status() != WL_CONNECTED) return -1;
  WiFiClientSecure tls;
  tls.setInsecure();   // shortcut: no certificate check; upgrade: tls.setCACert(<Supabase root CA>)
  HTTPClient http;
  if (!http.begin(tls, HELP_URL)) return -2;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " DEVICE_TOKEN);
  http.setTimeout(8000);
  char body[96];
  snprintf(body, sizeof body, "{\"event_id\":\"%s\",\"kind\":\"help_requested\"}", eventId);
  Serial.println(body);
  int code = http.POST((uint8_t*)body, strlen(body));
  if (code > 0) Serial.printf("   server replied %d: %s\n", code, http.getString().c_str());   // backend's JSON, never the token
  else          Serial.printf("   no reply: %s\n", http.errorToString(code).c_str());
  http.end();
  return code;
}

// true = finished (delivered or permanently rejected); false = try again later
bool deliverHelp(const char* eventId) {
  int code = postHelp(eventId);
  if (code == 200) { Serial.println("   help alert delivered: carer app will show it"); return true; }
  if (code == 401) { Serial.println("   REJECTED 401: check DEVICE_TOKEN in secrets.h"); return true; }
  if (code >= 400 && code < 500) { Serial.printf("   REJECTED %d: request format\n", code); return true; }
  Serial.printf("   not delivered (%d), retrying with the same event_id\n", code);
  return false;
}

void requestHelp() {
  char id[37];
  newUuid(id);
  if (deliverHelp(id)) return;
  if (pendingCount < 5) strcpy(pendingHelp[pendingCount++], id);
  else Serial.println("   too many unsent help alerts; this one is dropped");
}

void retryHelp() {
  if (!pendingCount || !deliverHelp(pendingHelp[0])) return;
  for (int i = 1; i < pendingCount; i++) strcpy(pendingHelp[i - 1], pendingHelp[i]);
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
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  WiFi.setTxPower(WIFI_POWER_8_5dBm);   // lower current spikes; hotspot is close by
  while (WiFi.status() != WL_CONNECTED && millis() < 15000) delay(250);
  Serial.println(WiFi.status() == WL_CONNECTED ? "WiFi: connected" : "WiFi: not connected (help alerts will retry)");

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
  static unsigned long strongSince = 0, weakSince = 0, lastRetry = 0, lastPrint = 0, lastPing = 0;
  unsigned long now = millis();
  int rssi = currentRssi();

  // Home/away is only judged once the anchor has been heard: an unpowered anchor must not make the band scream.
  if (anchorEverSeen) {
    if (rssi >= RSSI_HOME) { if (!strongSince) strongSince = now; } else strongSince = 0;
    if (rssi <  RSSI_AWAY) { if (!weakSince)   weakSince   = now; } else weakSince   = 0;
    if (!home && strongSince && now - strongSince >= HOME_MS) {
      home = true; stopBuzz();
      Serial.println(">>> BACK HOME (buzzer off)");
      tellLaptop("back_home");
    }
    if (home && weakSince && now - weakSince >= AWAY_MS) {
      home = false; buzz(P_AWAY, true);
      Serial.println(">>> LEFT HOME (buzzer on, short press stops it)");
      tellLaptop("left_home");
    }
  }

  if (now - lastRetry >= 5000) { lastRetry = now; retryHelp(); }
  if (now - lastPing >= 5000)  { lastPing = now;  tellLaptop("heartbeat"); }   // laptop only: keeps "Band online" in the app

  if (now - lastPrint >= 2000) {
    lastPrint = now;
    const char* state = !anchorEverSeen ? "WAITING FOR HOME BEACON" : (home ? "AT HOME" : "LEFT HOME");
    Serial.printf("%s | signal %d%s\n", state, rssi, pendingCount ? " | help alert waiting to send" : "");
  }
}
