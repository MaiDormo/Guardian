/*
 * Guardian ESP32-S3 — reference firmware sketch (DESIGNED, NOT DEPLOYED)
 *
 * Mirrors data/sim/radar_simulator.py buildEvent() schema.
 * UART parse stubs only — replace TODO blocks with vendor frame parsers.
 *
 * Post-hackathon: publish JSON to MQTT topics documented in hardware/README.md
 * or POST directly to BACKEND_URL/ingest via WiFi HTTP client.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ── Placeholder config (set at build / provisioning time) ─────────────────────
#define HOME_ID           "shenzhen-ahma-01"
#define BACKEND_URL       "http://192.168.1.10:8000/ingest"
#define WIFI_SSID         "YOUR_SSID"
#define WIFI_PASS         "YOUR_PASSWORD"

// ── Pin map (see hardware/README.md) ────────────────────────────────────────
#define PIN_UART_FALL_TX  17
#define PIN_UART_FALL_RX  18
#define PIN_UART_BREATH_TX 8
#define PIN_UART_BREATH_RX 9
#define PIN_UART_PRES_TX  43
#define PIN_UART_PRES_RX  44
#define PIN_STATUS_LED    4

#define UART_FALL   Serial1
#define UART_BREATH Serial2
#define UART_PRES   Serial0

// ── Room assignment per LD2410 instance (multi-sensor install) ───────────────
#define ROOM_BEDROOM    "bedroom"
#define ROOM_BATHROOM   "bathroom"
#define ROOM_KITCHEN    "kitchen"
#define ROOM_LIVING     "living_room"

static const char* ISO8601_NOW = "2026-01-01T00:00:00Z";  // replace with NTP

// ── buildEvent — same shape as radar_simulator.py ───────────────────────────

String buildEvent(
    const char* eventType,
    const char* source,
    const char* timestamp,
    float confidence,
    const char* room,          // nullable — pass "" to omit
    const char* payloadJson     // already-serialised JSON object
) {
  String ev = "{";
  ev += "\"event_type\":\""; ev += eventType; ev += "\",";
  ev += "\"source\":\""; ev += source; ev += "\",";
  ev += "\"timestamp\":\""; ev += timestamp; ev += "\",";
  ev += "\"confidence\":"; ev += String(confidence, 2);
  if (room && room[0] != '\0') {
    ev += ",\"room\":\""; ev += room; ev += "\"";
  }
  ev += ",\"payload\":"; ev += payloadJson;
  ev += "}";
  return ev;
}

// ── Example event builders (payload keys verbatim from simulator) ─────────────

String buildPresenceDetected(const char* room, int dwellS, const char* motion) {
  String payload = "{\"targets\":1,\"dwell_s\":" + String(dwellS) +
                   ",\"motion\":\"" + String(motion) + "\"}";
  return buildEvent("presence_detected", "mmwave_ld2410", ISO8601_NOW, 0.97, room, payload);
}

String buildPresenceEnded(const char* room) {
  return buildEvent("presence_ended", "mmwave_ld2410", ISO8601_NOW, 0.97, room, "{}");
}

String buildFallDetected(const char* room, int stationaryS) {
  String payload = "{\"posture\":\"prone\",\"stationary_s\":" + String(stationaryS) + "}";
  return buildEvent("fall_detected", "mmwave_mr60fda1", ISO8601_NOW, 0.95, room, payload);
}

String buildBreathingUpdate(const char* room, int rateBpm, bool inBaseline, float overnightH) {
  String payload = "{\"rate_bpm\":" + String(rateBpm) +
                   ",\"in_baseline\":" + (inBaseline ? "true" : "false") +
                   ",\"overnight_dwell_h\":" + String(overnightH, 1) + "}";
  return buildEvent("breathing_update", "mmwave_mr60bha2", ISO8601_NOW, 0.93, room, payload);
}

String buildMultiPresence(const char* room, int targets) {
  String payload = "{\"targets\":" + String(targets) + ",\"motion\":\"mixed\"}";
  return buildEvent("multi_presence_detected", "mmwave_ld2410", ISO8601_NOW, 0.97, room, payload);
}

// ── UART parse stubs — replace with vendor protocol parsers ─────────────────

void parseMr60fda1Frame(const uint8_t* buf, size_t len) {
  // TODO: Seeed MR60FDA1 datasheet — detect fall posture + stationary duration
  (void)buf; (void)len;
  // On fall: postIngest(buildFallDetected(ROOM_BATHROOM, 12));
}

void parseMr60bha2Frame(const uint8_t* buf, size_t len) {
  // TODO: Seeed MR60BHA2 datasheet — breathing rate + in-bed presence
  (void)buf; (void)len;
  // Periodic: postIngest(buildBreathingUpdate(ROOM_BEDROOM, 14, true, 7.8));
}

void parseLd2410Frame(const uint8_t* buf, size_t len, const char* room) {
  // TODO: Hi-Link LD2410 UART protocol — targets, dwell, motion state
  (void)buf; (void)len; (void)room;
  // On enter: postIngest(buildPresenceDetected(room, 0, "moving"));
  // On leave: postIngest(buildPresenceEnded(room));
}

// ── Transport — HTTP POST to Guardian backend (demo path) ─────────────────────

bool postIngest(const String& eventJson) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(eventJson);
  http.end();
  return code == 200;
}

// MQTT alternative (design-time — not used in hackathon demo):
//   topic: guardian/{HOME_ID}/events/presence | /fall | /breathing
//   payload: same eventJson string

void setup() {
  pinMode(PIN_STATUS_LED, OUTPUT);
  UART_FALL.begin(115200, SERIAL_8N1, PIN_UART_FALL_RX, PIN_UART_FALL_TX);
  UART_BREATH.begin(115200, SERIAL_8N1, PIN_UART_BREATH_RX, PIN_UART_BREATH_TX);
  UART_PRES.begin(256000, SERIAL_8N1, PIN_UART_PRES_RX, PIN_UART_PRES_TX);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  // TODO: NTP → ISO8601_NOW
}

void loop() {
  // Poll UART rings; dispatch parse stubs
  // digitalWrite(PIN_STATUS_LED, WiFi.status() == WL_CONNECTED ? HIGH : LOW);
  delay(50);
}
