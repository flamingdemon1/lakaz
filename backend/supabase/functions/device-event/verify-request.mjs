// From this directory: node verify-request.mjs (Node 24).
// Sample request for Kavish; replace the sample bearer token at runtime:
// POST https://<project-ref>.supabase.co/functions/v1/device-event
// Authorization: Bearer <device-token>
// Content-Type: application/json
// {"event_id":"123e4567-e89b-42d3-a456-426614174000","kind":"help_requested"}
// Generate a fresh UUID for each press; reuse it when retrying that press.
// The function is not deployed yet. This check uses no network or credentials.

import assert from "node:assert/strict";
import { createDeviceEventHandler } from "./request.ts";

const event = {
  event_id: "123e4567-e89b-42d3-a456-426614174000",
  kind: "help_requested",
};
const alert = {
  ...event,
  device_id: "d99d5080-585a-4b57-94f4-a09d3af42cea",
  received_at: "2026-11-13T09:00:00Z",
  acknowledged_at: null,
};
let calls = 0;
const handler = createDeviceEventHandler(async (token, payload) => {
  calls++;
  assert.deepEqual(payload, event);
  if (token === "sample-failure") throw new Error("internal details");
  return token === "sample-token" ? alert : null;
});
const url = "https://example.invalid/functions/v1/device-event";
function post(body, token = "Bearer sample-token", contentType = "application/json") {
  return handler(new Request(url, {
    method: "POST",
    headers: { authorization: token, "content-type": contentType },
    body,
  }));
}

assert.equal((await handler(new Request(url))).status, 405);
assert.equal((await post("{}", "")).status, 401);
assert.equal((await post("{}", "Bearer sample-token", "text/plain")).status, 415);
assert.equal((await post("{")).status, 400);
assert.equal((await post(JSON.stringify({ ...event, device_id: "spoofed" }))).status, 400);
assert.equal((await post(JSON.stringify({ ...event, event_id: "bad" }))).status, 400);
assert.equal((await post(JSON.stringify({ ...event, kind: "other" }))).status, 400);
assert.equal((await post(" ".repeat(1025))).status, 413);
assert.equal(calls, 0, "Invalid input must never reach the database adapter");

const accepted = await post(JSON.stringify(event));
assert.equal(accepted.status, 200);
assert.deepEqual(await accepted.json(), alert);
assert.equal((await post(JSON.stringify(event), "Bearer unknown")).status, 401);
const failure = await post(JSON.stringify(event), "Bearer sample-failure");
assert.equal(failure.status, 500);
assert.deepEqual(await failure.json(), { error: "intake_failed" });
assert.equal(calls, 3);
console.log("Passed 11 request checks using a sample alert and a stubbed database.");
