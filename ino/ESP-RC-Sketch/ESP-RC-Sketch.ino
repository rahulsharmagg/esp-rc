/**
 * ============================================================================
 * Project: ESP32 BLE RC & Autonomous Obstacle-Avoiding Robot (esp32_car)
 * Firmware: 1.2.310 (Build 310)
 *
 * Changes vs 1.1.4
 *   - WebSocket Cloud Relay support with session code handshaking.
 *   - Default OTA URL pointed to custom production endpoint.
 *   - Optimized NVS session storage and cleaned legacy URLs.
 *   - OTA is now reboot-then-flash. The BLE command only sets a flag; loop()
 *     validates Wi-Fi/DNS, stores the request in NVS, sends OTA_READY and
 *     reboots. On the next boot, BEFORE BLE starts, the car rejoins Wi-Fi (same
 *     IP), serves the port-81 WebSocket for live progress and flashes with
 *     nearly all heap free (BLE + TLS together do not fit on a WROOM).
 *   - Failure reasons are stored and reported over BLE after the reboot.
 *   - Extra OTA diagnostics (URL, heap, TLS lastError) and one connect retry.
 *   - DIAG command returns heap, max block and version.
 *   - Plain-HTTP OTA URLs are supported (for a local test server).
 *   - Removed the useless HTTP fallback and the HTTPClient/WiFiServer includes.
 *   - Loop task stack raised to 16 KB (TLS needs it).
 *   - WebSocket server: buffered handshake, ping/pong, 127-length guard,
 *     payload cap, restart after Wi-Fi off/on.
 *   - Wi-Fi: WIFI:CONNB (base64 ssid/pass) and WIFI_NETB for ':' in names.
 *   - Battery uses analogReadMilliVolts() (factory calibrated).
 *   - Motor pins forced LOW at the very start of setup().
 *   - Auto-mode delays replaced by waitMs() so a manual command can interrupt.
 *   - Malformed E:/D:/P: commands no longer fall through to stop.
 *   - setMaxPreferred typo fixed, version banner uses FIRMWARE_VERSION.
 *
 * Build settings (Arduino IDE):
 *   Partition Scheme : Minimal SPIFFS (1.9MB APP with OTA / 190KB SPIFFS)
 *   Core Debug Level : None
 *   Upload the app-only file (Sketch -> Export Compiled Binary -> *.ino.bin)
 *
 * Hardware:
 *   ESP32 WROOM (Core 3.x), L298N, SG90, HC-SR04, 2x IR sensors
 * ============================================================================
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <HTTPUpdate.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <mbedtls/sha1.h>
#include <mbedtls/base64.h>

#include "Version.h"
#include "HardwareConfig.h"
#include "Battery.h"

// Instantiate optimized multi-cell battery monitor
BatteryManager batteryMonitor(BATTERY_CELLS, BATTERY_DIVIDER_RATIO);

// More stack for the Arduino loop task (TLS handshake during OTA)
SET_LOOP_TASK_STACK_SIZE(16 * 1024);

// OTA Configuration
static const char DEFAULT_OTA_URL[]  = "https://rc.codeblaze.in/firmware/esp32/latest/firmware.bin";

// Non-Volatile Storage (NVS) for Wi-Fi credential persistence
Preferences wifiPrefs;

// OTA state
volatile bool otaRequested = false;
bool otaInProgress = false;
String otaRequestUrl = "";
String otaSessionCode = "";
String bootOtaError = "";   // error from failed update, dispatched over BLE on next connect

// Forward declarations
void processCommand(const String& cmd);

// Wi-Fi power & connection state (default OFF to maximize battery life)
bool wifiRadioEnabled = false;
String activeConnectedSsid = "";
String targetConnectingSsid = "";
String targetConnectingPass = "";
unsigned long wifiConnectStartTime = 0;
bool isConnectingWifi = false;
bool isScanningWifiActive = false;
unsigned long wifiScanStartTime = 0;

// Wi-Fi async scan result queue
int scanResultCount = 0;
int currentScanDispatchIndex = 0;
unsigned long lastScanDispatchMillis = 0;

// Hardware pin definitions are configured in HardwareConfig.h
bool isHeadlightsOn = false;

// ============================================================================
// PWM & MOTOR TIMINGS
// ============================================================================
static const int PWM_FREQ = 1000;
static const int PWM_RES  = 8;

volatile int currentSpeed = 180;
static const int TURN_SPEED = 170;
static const int SAFE_DISTANCE_CM = 20;

static const int IR_BACKWARD_TIME      = 250;
static const int IR_TURN_TIME          = 400;
static const int BOTH_IR_BACKWARD_TIME = 400;
static const int BOTH_IR_TURN_TIME     = 400;
static const int ULTRASONIC_TURN_TIME  = 450;

#define FAILSAFE_TIMEOUT_MS 600

// ============================================================================
// SENSOR ENABLE/DISABLE REGISTRY
// ============================================================================
bool enableUltrasonic = true;
bool enableServo      = true;
bool enableIrLeft     = false;
bool enableIrRight    = false;

// ============================================================================
// BLE DEFINITIONS
// ============================================================================
#define DEVICE_NAME             "ESP32-RC-CAR"
#define SERVICE_UUID            "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX  "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX  "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

Servo scanServo;
static const int SERVO_CENTER = 90;
static const int SERVO_LEFT   = 150;
static const int SERVO_RIGHT  = 30;
int currentServoAngle         = SERVO_CENTER;

enum DriveMode {
  MODE_MANUAL = 0,
  MODE_AUTO_AVOID = 1,
  MODE_AUTO_PATROL = 2
};

volatile DriveMode currentMode = MODE_MANUAL;

BLEServer* pServer = nullptr;
BLECharacteristic* pTxCharacteristic = nullptr;
volatile bool deviceConnected = false;
bool oldDeviceConnected = false;

volatile unsigned long lastCommandTimestamp = 0;
volatile char lastCommandChar = 'S';
unsigned long lastTelemetryMillis = 0;
long lastMeasuredCenterDist = 100;
bool lastLeftIrBlocked = false;
bool lastRightIrBlocked = false;

static int cachedLeftSpeed = -1;
static int cachedRightSpeed = -1;

// Forward declarations
void stopMotors();
void setSpeeds(int leftSpeed, int rightSpeed);
void moveForward();
void moveBackward();
void turnLeft();
void turnRight();
void decideDirectionAndTurn(bool abortable = false);
long getDistanceCM();
void notifyBle(const char* msg);
void notifyBle(const String& msg);

// ============================================================================
// MOTOR CONTROL PRIMITIVES
// ============================================================================

void setSpeeds(int leftSpeed, int rightSpeed) {
  leftSpeed = constrain(leftSpeed, 0, 255);
  rightSpeed = constrain(rightSpeed, 0, 255);

  if (leftSpeed != cachedLeftSpeed) {
    ledcWrite(ENA, leftSpeed);
    cachedLeftSpeed = leftSpeed;
  }
  if (rightSpeed != cachedRightSpeed) {
    ledcWrite(ENB, rightSpeed);
    cachedRightSpeed = rightSpeed;
  }
}

void moveForward() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  setSpeeds(currentSpeed, currentSpeed);
}

void moveBackward() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
  setSpeeds(currentSpeed, currentSpeed);
}

void turnLeft() {
  digitalWrite(IN1, LOW);  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  setSpeeds(TURN_SPEED, TURN_SPEED);
}

void turnRight() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);  digitalWrite(IN4, HIGH);
  setSpeeds(TURN_SPEED, TURN_SPEED);
}

void forwardLeft() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  setSpeeds(currentSpeed / 2, currentSpeed);
}

void forwardRight() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  setSpeeds(currentSpeed, currentSpeed / 2);
}

void reverseLeft() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
  setSpeeds(currentSpeed / 2, currentSpeed);
}

void reverseRight() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
  setSpeeds(currentSpeed, currentSpeed / 2);
}

void stopMotors() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
  setSpeeds(0, 0);
}

// Differential / tank drive: left, right in -255..+255
void setDifferential(int left, int right) {
  left = constrain(left, -255, 255);
  right = constrain(right, -255, 255);

  if (left > 0)      { digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW); }
  else if (left < 0) { digitalWrite(IN1, LOW);  digitalWrite(IN2, HIGH); }
  else               { digitalWrite(IN1, LOW);  digitalWrite(IN2, LOW); }

  if (right > 0)      { digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW); }
  else if (right < 0) { digitalWrite(IN3, LOW);  digitalWrite(IN4, HIGH); }
  else                { digitalWrite(IN3, LOW);  digitalWrite(IN4, LOW); }

  setSpeeds(abs(left), abs(right));
}

// ============================================================================
// STATUS LEDS, HEADLIGHTS & HORN
// ============================================================================

// Primary Status LED (BLE connection)
unsigned long lastStatusLedBlinkMillis = 0;
bool statusLedBlinkState = false;
static const unsigned long STATUS_LED_BLINK_INTERVAL_MS = 350;

void updateBleStatusLed() {
  if (deviceConnected) {
    digitalWrite(STATUS_LED_PIN, HIGH);
  } else {
    unsigned long now = millis();
    if (now - lastStatusLedBlinkMillis >= STATUS_LED_BLINK_INTERVAL_MS) {
      lastStatusLedBlinkMillis = now;
      statusLedBlinkState = !statusLedBlinkState;
      digitalWrite(STATUS_LED_PIN, statusLedBlinkState ? HIGH : LOW);
    }
  }
}

// Secondary Status LED (Wi-Fi scan, connection, OTA update, error status)
unsigned long lastNetLedMillis = 0;
bool netLedState = false;

void updateNetworkStatusLed() {
  unsigned long now = millis();

  // 1. OTA firmware update in progress: Ultra-fast strobe (40ms)
  if (otaInProgress) {
    if (now - lastNetLedMillis >= 40) {
      lastNetLedMillis = now;
      netLedState = !netLedState;
      digitalWrite(STATUS_LED_2_PIN, netLedState ? HIGH : LOW);
    }
    return;
  }

  // 2. OTA Error or boot update failure: 3 fast flashes, then pause
  if (bootOtaError.length() > 0) {
    unsigned long phase = now % 1200;
    bool on = (phase < 80) || (phase >= 180 && phase < 260) || (phase >= 360 && phase < 440);
    digitalWrite(STATUS_LED_2_PIN, on ? HIGH : LOW);
    return;
  }

  // 3. Wi-Fi Scan active: Fast double-blink pattern (ON 70, OFF 70, ON 70, OFF 350)
  if (isScanningWifiActive) {
    unsigned long phase = now % 560;
    bool on = (phase < 70) || (phase >= 140 && phase < 210);
    digitalWrite(STATUS_LED_2_PIN, on ? HIGH : LOW);
    return;
  }

  // 4. Wi-Fi Connecting: Steady medium blink (250ms ON / 250ms OFF)
  if (isConnectingWifi) {
    if (now - lastNetLedMillis >= 250) {
      lastNetLedMillis = now;
      netLedState = !netLedState;
      digitalWrite(STATUS_LED_2_PIN, netLedState ? HIGH : LOW);
    }
    return;
  }

  // 5. Wi-Fi Connected: Solid ON
  if (wifiRadioEnabled && WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED_2_PIN, HIGH);
    return;
  }

  // 6. Wi-Fi Radio enabled but not connected: Heartbeat pulse (single 60ms flash every 2s)
  if (wifiRadioEnabled) {
    unsigned long phase = now % 2000;
    digitalWrite(STATUS_LED_2_PIN, (phase < 60) ? HIGH : LOW);
    return;
  }

  // 7. Wi-Fi Radio OFF: LED completely OFF (battery saver)
  digitalWrite(STATUS_LED_2_PIN, LOW);
}

void updateStatusLed() {
  updateBleStatusLed();
  updateNetworkStatusLed();
}

void setHeadlights(bool on) {
  isHeadlightsOn = on;
  digitalWrite(HEADLIGHT_LEFT_PIN, on ? HIGH : LOW);
  digitalWrite(HEADLIGHT_RIGHT_PIN, on ? HIGH : LOW);
  Serial.printf("[LIGHTS] Dual Headlights: %s\n", on ? "ON" : "OFF");
}

void setHorn(bool on) {
  digitalWrite(BUZZER_PIN, on ? HIGH : LOW);
  Serial.printf("[HORN] Buzzer: %s\n", on ? "ON" : "OFF");
}

// ============================================================================
// ULTRASONIC DISTANCE SENSOR
// ============================================================================

long getDistanceCM() {
  if (!enableUltrasonic) return -1;

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 18000);
  if (duration == 0) return -1;
  return (long)(duration * 0.0343f / 2.0f);
}

// ============================================================================
// INTERRUPTIBLE WAIT (aborts on mode change)
// ============================================================================

// Returns false if 'abortable' and the mode is no longer AUTO (a manual command arrived).
static bool waitMs(unsigned long ms, bool abortable) {
  unsigned long t = millis();
  while (millis() - t < ms) {
    if (abortable && currentMode != MODE_AUTO_AVOID) return false;
    delay(2);
  }
  return true;
}

// ============================================================================
// ULTRASONIC & SERVO DECISION LOGIC
// ============================================================================

void decideDirectionAndTurn(bool abortable) {
  if (!enableServo || !enableUltrasonic) {
    turnRight();
    if (!waitMs(ULTRASONIC_TURN_TIME, abortable)) return;
    stopMotors();
    return;
  }

  long leftDist;
  long rightDist;

  scanServo.write(SERVO_LEFT);
  currentServoAngle = SERVO_LEFT;
  if (!waitMs(280, abortable)) { scanServo.write(SERVO_CENTER); currentServoAngle = SERVO_CENTER; return; }
  leftDist = getDistanceCM();

  scanServo.write(SERVO_RIGHT);
  currentServoAngle = SERVO_RIGHT;
  if (!waitMs(380, abortable)) { scanServo.write(SERVO_CENTER); currentServoAngle = SERVO_CENTER; return; }
  rightDist = getDistanceCM();

  scanServo.write(SERVO_CENTER);
  currentServoAngle = SERVO_CENTER;
  if (!waitMs(240, abortable)) return;

  if (leftDist < 0) leftDist = 400;
  if (rightDist < 0) rightDist = 400;

  Serial.printf("[AUTO SCAN] Left: %ld cm | Right: %ld cm\n", leftDist, rightDist);

  if (leftDist > rightDist) {
    Serial.println("[AUTO] Decision -> Turning LEFT");
    turnLeft();
  } else {
    Serial.println("[AUTO] Decision -> Turning RIGHT");
    turnRight();
  }
  if (!waitMs(ULTRASONIC_TURN_TIME, abortable)) return;

  stopMotors();
}

// ============================================================================
// AUTONOMOUS ROUTINE (Priority: IR Dual -> IR Left -> IR Right -> Ultrasonic)
// ============================================================================

// Back up, then turn. Returns false if interrupted by a manual command.
static bool avoidManeuver(int backMs, bool turnToRight, int turnMs) {
  stopMotors();
  moveBackward();
  if (!waitMs(backMs, true)) return false;
  if (turnToRight) turnRight(); else turnLeft();
  if (!waitMs(turnMs, true)) return false;
  stopMotors();
  return true;
}

void runAutonomousObstacleAvoidance() {
  bool leftBlocked  = enableIrLeft ? (digitalRead(IR_LEFT) == IR_OBSTACLE_STATE) : false;
  bool rightBlocked = enableIrRight ? (digitalRead(IR_RIGHT) == IR_OBSTACLE_STATE) : false;
  lastLeftIrBlocked = leftBlocked;
  lastRightIrBlocked = rightBlocked;

  long distanceCenter = enableUltrasonic ? getDistanceCM() : -1;
  if (distanceCenter > 0) lastMeasuredCenterDist = distanceCenter;

  if (leftBlocked && rightBlocked) {
    Serial.println("[AUTO] Both IR sensors blocked!");
    avoidManeuver(BOTH_IR_BACKWARD_TIME, true, BOTH_IR_TURN_TIME);
    return;
  }

  if (leftBlocked) {
    Serial.println("[AUTO] Left IR blocked!");
    avoidManeuver(IR_BACKWARD_TIME, true, IR_TURN_TIME);
    return;
  }

  if (rightBlocked) {
    Serial.println("[AUTO] Right IR blocked!");
    avoidManeuver(IR_BACKWARD_TIME, false, IR_TURN_TIME);
    return;
  }

  if (enableUltrasonic && distanceCenter > 0 && distanceCenter < SAFE_DISTANCE_CM) {
    Serial.println("[AUTO] Ultrasonic obstacle detected!");
    stopMotors();
    decideDirectionAndTurn(true);
    return;
  }

  moveForward();
  delay(15);
}

// ============================================================================
// BASE64 HELPERS (for ':' and other special characters in Wi-Fi names)
// ============================================================================

static bool b64Decode(const String& in, String& out) {
  unsigned char buf[100];
  size_t olen = 0;
  int r = mbedtls_base64_decode(buf, sizeof(buf) - 1, &olen,
                                (const unsigned char*)in.c_str(), in.length());
  if (r != 0) return false;
  buf[olen] = '\0';
  out = String((char*)buf);
  return true;
}

static String b64Encode(const String& in) {
  unsigned char buf[100];
  size_t olen = 0;
  if (in.length() > 60) return String("");
  int r = mbedtls_base64_encode(buf, sizeof(buf) - 1, &olen,
                                (const unsigned char*)in.c_str(), in.length());
  if (r != 0) return String("");
  buf[olen] = '\0';
  return String((char*)buf);
}

// ============================================================================
// BLE NOTIFICATION HELPERS
// ============================================================================

void notifyBle(const char* msg) {
  if (deviceConnected && pTxCharacteristic) {
    pTxCharacteristic->setValue((uint8_t*)msg, strlen(msg));
    pTxCharacteristic->notify();
  }
}

void notifyBle(const String& msg) {
  notifyBle(msg.c_str());
}

// ============================================================================
// WI-FI MANAGEMENT
// ============================================================================

void scanWifiNetworks() {
  if (!wifiRadioEnabled) {
    WiFi.mode(WIFI_STA);
    delay(50);
    wifiRadioEnabled = true;
  }
  Serial.println("[WIFI] Initiating async 2.4GHz network scan...");
  WiFi.scanDelete();
  WiFi.scanNetworks(true);
  isScanningWifiActive = true;
  wifiScanStartTime = millis();
  scanResultCount = 0;
  currentScanDispatchIndex = 0;
  notifyBle("WIFI_SCAN_START");
}

void saveWifiCredentials(const String& ssid, const String& pass) {
  if (ssid.length() == 0) return;
  wifiPrefs.begin("rc_wifi", false);
  wifiPrefs.putString("ssid", ssid);
  wifiPrefs.putString("pass", pass);
  wifiPrefs.end();
  Serial.printf("[NVS] Persisted WiFi credentials for '%s'\n", ssid.c_str());
}

void loadWifiCredentials(String& ssid, String& pass) {
  wifiPrefs.begin("rc_wifi", true);
  ssid = wifiPrefs.getString("ssid", "");
  pass = wifiPrefs.getString("pass", "");
  wifiPrefs.end();
}

void clearWifiCredentials() {
  wifiPrefs.begin("rc_wifi", false);
  wifiPrefs.clear();
  wifiPrefs.end();
  Serial.println("[NVS] Cleared stored WiFi credentials.");
}

void connectWifi(const String& ssid, const String& pass) {
  if (!wifiRadioEnabled) {
    WiFi.mode(WIFI_STA);
    wifiRadioEnabled = true;
  }
  Serial.printf("[WIFI] Connecting to SSID: %s\n", ssid.c_str());
  targetConnectingSsid = ssid;
  targetConnectingPass = pass;
  isConnectingWifi = true;
  wifiConnectStartTime = millis();

  if (pass.length() > 0) WiFi.begin(ssid.c_str(), pass.c_str());
  else                   WiFi.begin(ssid.c_str());
}

void autoConnectSavedWifi() {
  String savedSsid, savedPass;
  loadWifiCredentials(savedSsid, savedPass);
  if (savedSsid.length() > 0) {
    Serial.printf("[WIFI] Found saved network '%s'. Attempting auto-connect...\n", savedSsid.c_str());
    connectWifi(savedSsid, savedPass);
  } else {
    Serial.println("[WIFI] No saved network credentials found in NVS.");
    notifyBle("WIFI_STATUS:DISCONNECTED:0.0.0.0:0:");
  }
}

void disconnectWifi() {
  WiFi.disconnect(true);
  activeConnectedSsid = "";
  isConnectingWifi = false;
  notifyBle("WIFI_STATUS:DISCONNECTED:0.0.0.0:0:");
  Serial.println("[WIFI] Disconnected from network.");
}

void turnWifiRadioOff() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  wifiRadioEnabled = false;
  activeConnectedSsid = "";
  isConnectingWifi = false;
  notifyBle("WIFI_STATUS:OFF:0.0.0.0:0:");
  Serial.println("[WIFI] Radio POWERED OFF (Battery Saver Active)");
}

// ============================================================================
// OVER-THE-AIR (OTA) FIRMWARE UPDATE  (reboot-then-flash design)
//
//  Phase 1 (loop, BLE still up): check Wi-Fi + DNS, store the request in NVS,
//          send OTA_READY:<ip>:81 over BLE, reboot.
//  Phase 2 (setup, BEFORE BLE exists): reconnect Wi-Fi, start the port-81
//          WebSocket, wait for the app, download + flash with ~all heap free.
//  On failure the reason is saved to NVS, the car reboots into normal mode and
//  reports OTA_ERROR:<reason> over BLE as soon as the app reconnects.
// ============================================================================

static const char OTA_NS[] = "rc_ota";

static String hostFromUrl(const String& url) {
  int s = url.indexOf("://");
  s = (s < 0) ? 0 : s + 3;
  int e = url.indexOf('/', s);
  String host = (e < 0) ? url.substring(s) : url.substring(s, e);
  int colon = host.indexOf(':');            // strip :port
  if (colon >= 0) host = host.substring(0, colon);
  return host;
}

static uint16_t portFromUrl(const String& url) {
  int s = url.indexOf("://");
  s = (s < 0) ? 0 : s + 3;
  int e = url.indexOf('/', s);
  String hostPart = (e < 0) ? url.substring(s) : url.substring(s, e);
  int colon = hostPart.indexOf(':');
  if (colon >= 0) {
    int p = hostPart.substring(colon + 1).toInt();
    if (p > 0 && p <= 65535) return (uint16_t)p;
  }
  return url.startsWith("https://") ? 443 : 80;
}

static void sanitizeOtaUrl(String& url, String& code) {
  url.trim();

  // Extract code from ?code= or &code= (very simple, no legacy parameters)
  code = "";
  int idx = url.indexOf("?code=");
  if (idx == -1) idx = url.indexOf("&code=");
  if (idx != -1) {
    int start = idx + 6;
    int amp = url.indexOf('&', start);
    code = (amp == -1) ? url.substring(start) : url.substring(start, amp);
    code.trim();
  }

  // Automatic HTTPS upgrade for LiteSpeed 301
  if (url.startsWith("http://rc.codeblaze.in") || url.startsWith("http://www.rc.codeblaze.in")) {
    url = "https://" + url.substring(7);
  }
}

static void saveOtaError(const String& msg) {
  Preferences p;
  p.begin(OTA_NS, false);
  String shortMsg = msg;
  shortMsg.trim();
  if (shortMsg.length() > 32) shortMsg = shortMsg.substring(0, 32);
  p.putString("err", shortMsg);
  p.end();
}

static String takeOtaError() {
  Preferences p;
  p.begin(OTA_NS, false);
  String e = p.getString("err", "");
  if (e.length() > 0) p.remove("err");
  p.end();
  return e;
}

// ============================================================================
// DIRECT LIVE OTA (Reboot-Free High-Memory Download & Flash)
// ============================================================================

void startDirectOta() {
  String url = otaRequestUrl.length() ? otaRequestUrl : String(DEFAULT_OTA_URL);
  String code = otaSessionCode;
  sanitizeOtaUrl(url, code);

  // If code exists and not yet in query string, ensure ?code= is attached
  if (code.length() > 0 && url.indexOf("code=") == -1) {
    url += (url.indexOf('?') == -1 ? "?code=" : "&code=") + code;
  }

  Serial.println("\n[OTA] ===== STARTING LIVE FIRMWARE UPDATE =====");
  Serial.printf("[OTA] Firmware URL: %s\n", url.c_str());
  Serial.printf("[OTA] Code: %s\n", code.c_str());
  Serial.printf("[OTA] Free heap before start: %u bytes\n", (unsigned)ESP.getFreeHeap());

  stopMotors();
  currentMode = MODE_MANUAL;

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    saveOtaError("Bad URL scheme");
    otaInProgress = false;
    ESP.restart();
    return;
  }
  if (!wifiRadioEnabled || WiFi.status() != WL_CONNECTED) {
    saveOtaError("Wi-Fi not connected");
    otaInProgress = false;
    ESP.restart();
    return;
  }

  String host = hostFromUrl(url);
  uint16_t port = portFromUrl(url);
  IPAddress resolved;
  if (!WiFi.hostByName(host.c_str(), resolved)) {
    saveOtaError("DNS resolution failed");
    otaInProgress = false;
    ESP.restart();
    return;
  }

  otaInProgress = true;

  // 1. Requirement: Bluetooth MUST be completely off when downloading start
  Serial.println("[OTA] Turning OFF Bluetooth completely before downloading...");
  if (pServer && pServer->getAdvertising()) {
    pServer->getAdvertising()->stop();
  }
  BLEDevice::deinit(true);
  btStop();
  deviceConnected = false;
  delay(150);

  Serial.printf("[OTA] Bluetooth is OFF. Available Contiguous Heap: %u bytes, max block: %u\n",
                (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMaxAllocHeap());

  // 2. Download & Flash via HTTPUpdate (Single TLS connection has 100% of heap!)
  httpUpdate.onProgress([](int cur, int total) {
    static int last = -1;
    // Rapidly toggle secondary status LED on incoming firmware blocks
    static bool otaLedToggle = false;
    otaLedToggle = !otaLedToggle;
    digitalWrite(STATUS_LED_2_PIN, otaLedToggle ? HIGH : LOW);

    if (total <= 0) return;
    int pct = (int)(((int64_t)cur * 100) / total);
    if (pct != last && (pct % 5 == 0 || pct == 100)) {
      last = pct;
      Serial.printf("[OTA] %d%%\n", pct);
    }
  });

  httpUpdate.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
  httpUpdate.rebootOnUpdate(false);

  bool useTls = url.startsWith("https://");
  t_httpUpdate_return ret = HTTP_UPDATE_FAILED;

  for (int attempt = 1; attempt <= 2; attempt++) {
    Serial.printf("[OTA] Connecting via %s to: %s\n", useTls ? "HTTPS" : "HTTP", url.c_str());
    if (useTls) {
      WiFiClientSecure dlClient;
      dlClient.setInsecure();
      dlClient.setHandshakeTimeout(30);
      ret = httpUpdate.update(dlClient, url);
      if (ret == HTTP_UPDATE_FAILED) {
        char eb[100] = {0};
        int e = dlClient.lastError(eb, sizeof(eb));
        Serial.printf("[OTA] TLS error %d: %s\n", e, eb);
      }
    } else {
      WiFiClient dlClient;
      ret = httpUpdate.update(dlClient, url);
    }

    if (ret == HTTP_UPDATE_OK) break;

    // LiteSpeed 301 redirect fallback: upgrade to HTTPS for attempt 2
    if (!useTls && (httpUpdate.getLastError() == HTTP_UE_SERVER_WRONG_HTTP_CODE || url.startsWith("http://"))) {
      Serial.println("[OTA] HTTP redirected. Switching attempt 2 to HTTPS...");
      url.replace("http://", "https://");
      useTls = true;
      delay(1000);
      continue;
    }

    if (attempt < 2) delay(1500);
  }

  // 4. Handle result & reboot
  if (ret == HTTP_UPDATE_OK) {
    Serial.println("[OTA] Flash SUCCESS! Rebooting into new firmware...");
    digitalWrite(STATUS_LED_2_PIN, HIGH);
    delay(1000);
    ESP.restart();
  } else {
    String errStr = httpUpdate.getLastErrorString();
    if (errStr.length() == 0) errStr = "Flash failed";
    else if (errStr.indexOf("404") != -1) errStr = "HTTP 404";
    else if (errStr.indexOf("TLS") != -1 || errStr.indexOf("SSL") != -1) errStr = "TLS handshake error";
    else if (errStr.indexOf("space") != -1) errStr = "Partition full";
    else if (errStr.length() > 32) errStr = errStr.substring(0, 32);

    Serial.printf("[OTA] Flash FAILED: %s\n", errStr.c_str());
    saveOtaError(errStr);

    for (int i = 0; i < 6; i++) {
      digitalWrite(STATUS_LED_2_PIN, HIGH); delay(80);
      digitalWrite(STATUS_LED_2_PIN, LOW);  delay(80);
    }
    delay(1500);
    ESP.restart();
  }
}

// ============================================================================
// COMMAND HANDLER
// ============================================================================

void processCommand(const String& cmd) {
  if (cmd.length() == 0) return;
  if (otaInProgress) return;   // ignore everything while flashing

  lastCommandTimestamp = millis();
  char c = cmd.charAt(0);

  // OTA command handling (supports "OTA:UPDATE:<url>", "OTA:<url>", "UPDATE:<url>", or direct "http(s)://...")
  if (cmd.startsWith("OTA:UPDATE") || cmd.startsWith("OTA:http") || cmd.startsWith("http://") || cmd.startsWith("https://") || cmd.startsWith("UPDATE:http")) {
    otaRequestUrl = "";
    otaSessionCode = "";
    String payload = cmd;
    if (payload.startsWith("OTA:UPDATE:")) payload = payload.substring(11);
    else if (payload.startsWith("OTA:UPDATE")) payload = payload.substring(10);
    else if (payload.startsWith("UPDATE:"))     payload = payload.substring(7);
    else if (payload.startsWith("OTA:"))        payload = payload.substring(4);

    payload.trim();
    if (payload.length() > 0) {
      sanitizeOtaUrl(payload, otaSessionCode);
      otaRequestUrl = payload;
    }
    stopMotors();
    currentMode = MODE_MANUAL;
    otaRequested = true;   // handled in loop()
    notifyBle("OTA_READY:ESP32 starting OTA download");
    return;
  }
  if (cmd == "DIAG") {
    char d[80];
    snprintf(d, sizeof(d), "DIAG:%u,%u,%s", (unsigned)ESP.getFreeHeap(),
             (unsigned)ESP.getMaxAllocHeap(), FIRMWARE_VERSION);
    notifyBle(d);
    return;
  }
  if (cmd == "OTA:VERSION" || cmd == "FIRMWARE:VERSION") {
    char verBuf[32];
    snprintf(verBuf, sizeof(verBuf), "FIRMWARE_VER:%s", FIRMWARE_VERSION);
    notifyBle(verBuf);
    return;
  }

  // Wi-Fi control ("WIFI:SCAN", "WIFI:CONN:SSID:PASS", "WIFI:CONNB:b64ssid:b64pass", ...)
  if (cmd.startsWith("WIFI:")) {
    String sub = cmd.substring(5);
    if (sub == "SCAN") {
      scanWifiNetworks();
    } else if (sub.startsWith("CONNB:")) {
      int sep = sub.indexOf(':', 6);
      String ssid, pass;
      bool ok = false;
      if (sep != -1) {
        ok = b64Decode(sub.substring(6, sep), ssid);
        String p;
        ok = ok && b64Decode(sub.substring(sep + 1), p);
        pass = p;
      } else {
        ok = b64Decode(sub.substring(6), ssid);
      }
      if (ok && ssid.length() > 0) connectWifi(ssid, pass);
      else notifyBle("WIFI_STATUS:DISCONNECTED:0.0.0.0:0:");
    } else if (sub.startsWith("CONN:")) {
      int secondColon = sub.indexOf(':', 5);
      String ssid, pass;
      if (secondColon != -1) {
        ssid = sub.substring(5, secondColon);
        pass = sub.substring(secondColon + 1);
      } else {
        ssid = sub.substring(5);
        pass = "";
      }
      connectWifi(ssid, pass);
    } else if (sub == "DISC") {
      disconnectWifi();
    } else if (sub == "OFF") {
      turnWifiRadioOff();
    } else if (sub == "ON") {
      if (!wifiRadioEnabled) {
        WiFi.mode(WIFI_STA);
        wifiRadioEnabled = true;
        notifyBle("WIFI_STATUS:DISCONNECTED:0.0.0.0:0:");
      }
    } else if (sub == "AUTO" || sub == "AUTOCONN") {
      autoConnectSavedWifi();
    } else if (sub == "CLEAR") {
      clearWifiCredentials();
      disconnectWifi();
    } else if (sub == "STATUS") {
      if (!wifiRadioEnabled) {
        notifyBle("WIFI_STATUS:OFF:0.0.0.0:0:");
      } else if (WiFi.status() == WL_CONNECTED) {
        char statusBuf[96];
        snprintf(statusBuf, sizeof(statusBuf), "WIFI_STATUS:CONNECTED:%s:%d:%s",
                 WiFi.localIP().toString().c_str(), WiFi.RSSI(), WiFi.SSID().c_str());
        notifyBle(statusBuf);
      } else {
        notifyBle("WIFI_STATUS:DISCONNECTED:0.0.0.0:0:");
      }
    }
    return;
  }

  // Sensor enable/disable ("E:US:0", "E:IRL:1")
  if (c == 'E' && cmd.length() > 1 && cmd.charAt(1) == ':') {
    int secondColon = cmd.indexOf(':', 2);
    if (secondColon != -1) {
      String sensorKey = cmd.substring(2, secondColon);
      bool state = cmd.substring(secondColon + 1).toInt() == 1;

      if (sensorKey == "US") {
        enableUltrasonic = state;
        Serial.printf("[SENSOR CONFIG] Ultrasonic: %s\n", state ? "ENABLED" : "DISABLED");
      } else if (sensorKey == "SRV") {
        enableServo = state;
        Serial.printf("[SENSOR CONFIG] Servo: %s\n", state ? "ENABLED" : "DISABLED");
      } else if (sensorKey == "IRL") {
        enableIrLeft = state;
        Serial.printf("[SENSOR CONFIG] Left IR: %s\n", state ? "ENABLED" : "DISABLED");
      } else if (sensorKey == "IRR") {
        enableIrRight = state;
        Serial.printf("[SENSOR CONFIG] Right IR: %s\n", state ? "ENABLED" : "DISABLED");
      }
    }
    return;   // malformed E: commands are ignored, not treated as 'stop'
  }

  // Servo manual angle ("P:90")
  if (c == 'P' && cmd.length() > 1 && cmd.charAt(1) == ':') {
    int angle = constrain(cmd.substring(2).toInt(), 0, 180);
    scanServo.write(angle);
    currentServoAngle = angle;
    Serial.printf("[SERVO] Manual angle set to %d deg\n", angle);
    return;
  }

  // Single ping
  if (cmd == "PING") {
    long d = getDistanceCM();
    if (d > 0) lastMeasuredCenterDist = d;
    Serial.printf("[TEST] Ping result: %ld cm\n", d);
    return;
  }

  // Mode selection ('X'/'A' = AUTO, 'M'/'a' = MANUAL)
  if (c == 'A' || c == 'X') {
    currentMode = MODE_AUTO_AVOID;
    scanServo.write(SERVO_CENTER);
    currentServoAngle = SERVO_CENTER;
    Serial.println("[MODE] Engaged: AUTOMATIC (Obstacle Avoidance)");
    return;
  }
  if (c == 'a' || c == 'M') {
    currentMode = MODE_MANUAL;
    stopMotors();
    scanServo.write(SERVO_CENTER);
    currentServoAngle = SERVO_CENTER;
    Serial.println("[MODE] Engaged: MANUAL");
    return;
  }
  if (c == 'K') {   // manual servo sweep test
    Serial.println("[SERVO] Manual Scan Sweep Triggered from App");
    decideDirectionAndTurn(false);
    return;
  }

  // Headlights ('W' on, 'w' off)
  if (c == 'W') { setHeadlights(true);  return; }
  if (c == 'w') { setHeadlights(false); return; }

  // Horn ('U' on, 'u' off)
  if (c == 'U') { setHorn(true);  return; }
  if (c == 'u') { setHorn(false); return; }

  // Speed ("V200")
  if (c == 'V') {
    int val = cmd.substring(1).toInt();
    currentSpeed = constrain(val, 50, 255);
    Serial.printf("[CONFIG] Speed set to: %d\n", (int)currentSpeed);
    return;
  }

  // Differential tank drive ("D:180,-180")
  if (c == 'D' && cmd.length() > 1 && cmd.charAt(1) == ':') {
    int commaIdx = cmd.indexOf(',');
    if (commaIdx > 2) {
      currentMode = MODE_MANUAL;
      int leftPwr = cmd.substring(2, commaIdx).toInt();
      int rightPwr = cmd.substring(commaIdx + 1).toInt();
      setDifferential(leftPwr, rightPwr);
    }
    return;   // malformed D: commands are ignored
  }

  // Directional motion (manual touch inputs)
  currentMode = MODE_MANUAL;
  lastCommandChar = c;

  switch (c) {
    case 'F': moveForward();   break;
    case 'B': moveBackward();  break;
    case 'L': turnLeft();      break;
    case 'R': turnRight();     break;
    case 'G': forwardLeft();   break;
    case 'I': forwardRight();  break;
    case 'H': reverseLeft();   break;
    case 'J': reverseRight();  break;
    case 'S':
    default:
      stopMotors();
      break;
  }
}

// ============================================================================
// BLE CALLBACKS
// ============================================================================

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
  }

  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    if (!otaInProgress) {
      currentMode = MODE_MANUAL;
      stopMotors();
    }
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) override {
    String rxValue = pCharacteristic->getValue().c_str();
    rxValue.trim();

    if (rxValue.length() > 0) {
      processCommand(rxValue);   // OTA only sets a flag here, nothing heavy runs in this callback

      if (deviceConnected && pTxCharacteristic) {
        char ack[64];
        snprintf(ack, sizeof(ack), "ACK:%s", rxValue.c_str());
        pTxCharacteristic->setValue((uint8_t*)ack, strlen(ack));
        pTxCharacteristic->notify();
      }
    }
  }
};

// ============================================================================
// MAIN SETUP
// ============================================================================

void setup() {
  // 0. Safe pin state first: motors off before anything else runs
  pinMode(IN1, OUTPUT); digitalWrite(IN1, LOW);
  pinMode(IN2, OUTPUT); digitalWrite(IN2, LOW);
  pinMode(IN3, OUTPUT); digitalWrite(IN3, LOW);
  pinMode(IN4, OUTPUT); digitalWrite(IN4, LOW);
  pinMode(ENA, OUTPUT); digitalWrite(ENA, LOW);
  pinMode(ENB, OUTPUT); digitalWrite(ENB, LOW);

  Serial.begin(115200);
  delay(50);

  Serial.println();
  Serial.println("==========================================");
  Serial.printf(" ESP32 BLE Obstacle-Avoiding RC Car v%s (Build %d)\n", FIRMWARE_VERSION, BUILD_NUMBER);
  Serial.println(" Hardware: L298N + SG90 Servo + HC-SR04 + 2x IR");
  Serial.println(" Core 3.x | Web Bluetooth Nordic UART");
  Serial.println("==========================================");

  // 1. PWM on ENA & ENB (Core 3.x)
  ledcAttach(ENA, PWM_FREQ, PWM_RES);
  ledcAttach(ENB, PWM_FREQ, PWM_RES);
  stopMotors();

  // 2. Ultrasonic pins (use INPUT_PULLDOWN to prevent floating noise when unwired)
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT_PULLDOWN);
  digitalWrite(TRIG_PIN, LOW);

  // 3. Battery & IR inputs
  batteryMonitor.begin();
  pinMode(IR_LEFT, INPUT);
  pinMode(IR_RIGHT, INPUT);

  // 4. Status LEDs, headlights, buzzer
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  pinMode(STATUS_LED_2_PIN, OUTPUT);
  digitalWrite(STATUS_LED_2_PIN, LOW);
  pinMode(HEADLIGHT_LEFT_PIN, OUTPUT);
  pinMode(HEADLIGHT_RIGHT_PIN, OUTPUT);
  setHeadlights(false);
  pinMode(BUZZER_PIN, OUTPUT);
  setHorn(false);

  // 4b. Check for previous OTA error from failed update (reported over BLE)
  bootOtaError = takeOtaError();

  // 5. Servo (after motor pins are safe)
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  scanServo.setPeriodHertz(50);
  scanServo.attach(SERVO_PIN, 500, 2400);

  Serial.println("[SERVO] Testing sweep: LEFT -> RIGHT -> CENTER...");
  scanServo.write(SERVO_LEFT);
  delay(300);
  scanServo.write(SERVO_RIGHT);
  delay(450);
  scanServo.write(SERVO_CENTER);
  delay(250);
  Serial.println("[SERVO] Sweep test complete.");

  // 6. BLE
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_TX,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic* pRxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_RX,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxCharacteristic->setCallbacks(new RxCallbacks());

  pService->start();

  // 6.1 Standard Device Information Service (DIS, UUID 0x180A)
  BLEService* pDis = pServer->createService(BLEUUID((uint16_t)0x180A));
  BLECharacteristic* c;
  c = pDis->createCharacteristic(BLEUUID((uint16_t)0x2A29), BLECharacteristic::PROPERTY_READ);
  c->setValue("ESP32 RC");                    // Manufacturer Name String
  c = pDis->createCharacteristic(BLEUUID((uint16_t)0x2A24), BLECharacteristic::PROPERTY_READ);
  c->setValue("ESP32-ROBOT-1");               // Model Number String
  c = pDis->createCharacteristic(BLEUUID((uint16_t)0x2A26), BLECharacteristic::PROPERTY_READ);
  c->setValue(FIRMWARE_VERSION);              // Firmware Revision String
  c = pDis->createCharacteristic(BLEUUID((uint16_t)0x2A28), BLECharacteristic::PROPERTY_READ);
  c->setValue("4.0.0");                       // Software Revision String
  pDis->start();

  // 6.2 Advertising with standard Remote Control Appearance
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->addServiceUUID(BLEUUID((uint16_t)0x180A));
  pAdvertising->setAppearance(0x0180); // Generic Remote Control (Bluetooth SIG standard)
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);
  BLEDevice::setMTU(512);
  BLEDevice::startAdvertising();

  // 7. Wi-Fi OFF at boot (battery saver)
  WiFi.mode(WIFI_OFF);

  Serial.printf("[READY] BLE advertising. Heap: %u, max block: %u\n",
                (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMaxAllocHeap());
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
  // -1. OTA request (flag set by processCommand)
  if (otaRequested) {
    otaRequested = false;
    startDirectOta();
  }

  unsigned long currentMillis = millis();

  updateStatusLed();

  // 1. Non-blocking Wi-Fi scan result dispatcher
  if (isScanningWifiActive) {
    int16_t scanResult = WiFi.scanComplete();
    if (scanResult >= 0) {
      if (scanResultCount == 0) {
        scanResultCount = scanResult;
        currentScanDispatchIndex = 0;
        Serial.printf("[WIFI] Async scan complete. Found %d networks.\n", scanResult);
        char countBuf[32];
        snprintf(countBuf, sizeof(countBuf), "WIFI_SCAN_START:%d", scanResult);
        notifyBle(countBuf);
      }

      if (currentMillis - lastScanDispatchMillis >= 25) {
        lastScanDispatchMillis = currentMillis;

        if (currentScanDispatchIndex < scanResultCount && currentScanDispatchIndex < 15) {
          String ssid = WiFi.SSID(currentScanDispatchIndex);
          if (ssid.length() > 0) {
            int rssi = WiFi.RSSI(currentScanDispatchIndex);
            bool enc = (WiFi.encryptionType(currentScanDispatchIndex) != WIFI_AUTH_OPEN);
            char netMsg[96];
            if (ssid.indexOf(':') >= 0) {
              // ':' would break the colon-delimited message, send the name as base64
              snprintf(netMsg, sizeof(netMsg), "WIFI_NETB:%s:%d:%d",
                       b64Encode(ssid).c_str(), rssi, enc ? 1 : 0);
            } else {
              snprintf(netMsg, sizeof(netMsg), "WIFI_NET:%s:%d:%d", ssid.c_str(), rssi, enc ? 1 : 0);
            }
            notifyBle(netMsg);
            Serial.printf("  [%d] %s (%d dBm)\n", currentScanDispatchIndex + 1, ssid.c_str(), rssi);
          }
          currentScanDispatchIndex++;
        } else {
          isScanningWifiActive = false;
          WiFi.scanDelete();
          notifyBle("WIFI_SCAN_END");
        }
      }
    } else if (scanResult == -2 || (currentMillis - wifiScanStartTime > 10000)) {
      isScanningWifiActive = false;
      WiFi.scanDelete();
      Serial.println("[WIFI] Scan failed or timed out.");
      notifyBle("WIFI_SCAN_END");
    }
  }

  // 2. Non-blocking Wi-Fi connection monitor
  if (isConnectingWifi && wifiRadioEnabled) {
    if (WiFi.status() == WL_CONNECTED) {
      isConnectingWifi = false;
      activeConnectedSsid = WiFi.SSID();
      saveWifiCredentials(activeConnectedSsid, targetConnectingPass);
      String ip = WiFi.localIP().toString();
      int rssi = WiFi.RSSI();
      char connBuf[96];
      snprintf(connBuf, sizeof(connBuf), "WIFI_STATUS:CONNECTED:%s:%d:%s", ip.c_str(), rssi, activeConnectedSsid.c_str());
      notifyBle(connBuf);
      Serial.printf("[WIFI] Connected to %s! IP: %s (RSSI: %d dBm)\n", activeConnectedSsid.c_str(), ip.c_str(), rssi);

    } else if (currentMillis - wifiConnectStartTime > 12000) {
      isConnectingWifi = false;
      notifyBle("WIFI_STATUS:DISCONNECTED:0.0.0.0:0:");
      Serial.println("[WIFI] Connection timed out / failed.");
    }
  }

  bool isAnyClientConnected = deviceConnected;

  // 3. BLE re-advertising on disconnect
  if (!deviceConnected && oldDeviceConnected) {
    delay(100);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising after disconnect.");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    lastCommandTimestamp = currentMillis;
    currentMode = MODE_MANUAL;
    char verBuf[32];
    snprintf(verBuf, sizeof(verBuf), "FIRMWARE_VER:%s", FIRMWARE_VERSION);
    notifyBle(verBuf);
    if (bootOtaError.length()) {
      notifyBle("OTA_ERROR:" + bootOtaError);   // reason the last update failed
      bootOtaError = "";
    }
    Serial.println("[BLE] Client connected and synchronized!");
  }

  // 4. Mode execution
  if (currentMode == MODE_AUTO_AVOID) {
    runAutonomousObstacleAvoidance();
  } else {
    if (isAnyClientConnected) {
      if (lastCommandChar != 'S' && (currentMillis - lastCommandTimestamp > FAILSAFE_TIMEOUT_MS)) {
        stopMotors();
        lastCommandChar = 'S';
      }
    } else {
      stopMotors();
    }
  }

  // 5. Telemetry (every 100 ms when connected)
  if (isAnyClientConnected && (currentMillis - lastTelemetryMillis >= 100)) {
    lastTelemetryMillis = currentMillis;
    unsigned long uptimeSec = currentMillis / 1000;

    if (currentMode == MODE_MANUAL && lastCommandChar == 'S') {
      long d = enableUltrasonic ? getDistanceCM() : -1;
      if (d > 0) lastMeasuredCenterDist = d;
      lastLeftIrBlocked = enableIrLeft ? (digitalRead(IR_LEFT) == IR_OBSTACLE_STATE) : false;
      lastRightIrBlocked = enableIrRight ? (digitalRead(IR_RIGHT) == IR_OBSTACLE_STATE) : false;
    }

    // T:<uptime>,<center_dist_cm>,<ir_left>,<ir_right>,<servo_angle>,<battery_pct>,<battery_v>,<mode>
    char modeChar = (currentMode == MODE_AUTO_AVOID) ? 'A' : 'M';
    float batV = 7.8f;
    int batPct = getBatteryLevel(batV);

    char telemetry[80];
    snprintf(telemetry, sizeof(telemetry), "T:%lu,%ld,%d,%d,%d,%d,%.2f,%c",
             uptimeSec,
             lastMeasuredCenterDist,
             lastLeftIrBlocked ? 1 : 0,
             lastRightIrBlocked ? 1 : 0,
             currentServoAngle,
             batPct,
             batV,
             modeChar);

    notifyBle(telemetry);
  }

  delay(2);
}
