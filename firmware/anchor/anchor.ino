// Lakaz home anchor (ESP32 #1): Bluetooth beacon "LAKAZ-ANCHOR" that the band listens for.
// Optional: on-board LED shows the status from the laptop test server (simulator/mock.js).
// Libs: NimBLE-Arduino 2.x, ArduinoJson 7. Board: ESP32 Dev Module.
// Setup: copy secrets.example.h to secrets.h and fill it in (secrets.h is gitignored).
#include <WiFi.h>
#include <HTTPClient.h>
#include <NimBLEDevice.h>
#include <ArduinoJson.h>
#include "secrets.h"

#define ANCHOR_NAME "LAKAZ-ANCHOR"
#define LED_PIN     2                  // on-board blue LED on most ESP32 DevKits
#define POLL_MS     2000
#define BLE_POWER   ESP_PWR_LVL_P9     // lower = smaller "home": ESP_PWR_LVL_N12 .. ESP_PWR_LVL_P9

// LED: 0 = short blip every 2 s (beacon on, no status), 1 = solid (home), 2 = 1 Hz (away), 3 = 5 Hz (help)
int ledMode = 0;
unsigned long lastPoll = 0;

void startBeacon() {
  NimBLEDevice::init(ANCHOR_NAME);
  NimBLEDevice::setPower(BLE_POWER);
  NimBLEAdvertisementData adv;
  adv.setFlags(0x06);           // general discoverable, BLE only
  adv.setName(ANCHOR_NAME);     // the band matches on this name
  NimBLEDevice::getAdvertising()->setAdvertisementData(adv);
  NimBLEDevice::startAdvertising();
  Serial.println("Beacon on: " ANCHOR_NAME);
}

void pollStatus() {
  if (!strlen(STATUS_URL) || WiFi.status() != WL_CONNECTED) { ledMode = 0; return; }
  HTTPClient http;
  http.setTimeout(1500);
  http.begin(STATUS_URL);
  int code = http.GET();
  if (code != 200) { ledMode = 0; http.end(); return; }
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, http.getString());
  http.end();
  if (err) { ledMode = 0; return; }

  String status = doc["status"] | "";
  status.toLowerCase();
  int level = doc["level"] | 0;
  if (status == "sos")                                              ledMode = 3;
  else if (level > 0 || status == "away" || status == "left_home" || status == "left home")  ledMode = 2;
  else if (status == "home")                                        ledMode = 1;
  else                                                              ledMode = 0;
}

void updateLed() {
  unsigned long t = millis();
  bool on;
  if (ledMode == 1)      on = true;
  else if (ledMode == 2) on = (t / 500) % 2;
  else if (ledMode == 3) on = (t / 100) % 2;
  else                   on = (t % 2000) < 50;
  digitalWrite(LED_PIN, on);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  startBeacon();
  if (strlen(STATUS_URL)) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }
}

void loop() {
  if (millis() - lastPoll >= POLL_MS) { lastPoll = millis(); pollStatus(); }
  updateLed();
}
