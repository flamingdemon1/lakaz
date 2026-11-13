// Device intake and server-only heartbeat RPC. Owner: Fahim; review/deploy: Shihad.
import { createDeviceEventHandler } from "./request.ts";

Deno.serve(createDeviceEventHandler(async (token, event) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing server configuration");

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  /** Takes no inputs. Updates the authenticated band's timestamp, returning token validity. */
  async function heartbeat(): Promise<boolean> {
    const response = await fetch(new URL("/rest/v1/rpc/submit_heartbeat", url), {
      method: "POST",
      headers: { apikey: key!, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token_hash: tokenHash }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Heartbeat RPC failed");
    return await response.json() === true;
  }

  // Standalone heartbeats validate the token through SQL and never call alert intake.
  if (event.kind === "heartbeat") return await heartbeat() ? { ok: true as const } : null;

  const response = await fetch(new URL("/rest/v1/rpc/submit_device_event", url), {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_token_hash: tokenHash,
      p_event_id: event.event_id,
      p_kind: event.kind,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Alert RPC failed");

  // A composite SQL return can arrive as a row array; SQL NULL can
  // also appear as a composite with all fields null.
  const result = await response.json();
  const row = Array.isArray(result) && result.length <= 1 ? result[0] ?? null : result;
  if (row === null || (row?.device_id === null && row?.event_id === null &&
      row?.kind === null && row?.received_at === null && row?.acknowledged_at === null)) {
    return null;
  }
  if (typeof row?.device_id !== "string" || row.event_id !== event.event_id ||
      row.kind !== event.kind || typeof row.received_at !== "string" ||
      !(row.acknowledged_at === null || typeof row.acknowledged_at === "string")) {
    throw new Error("Unexpected alert RPC response");
  }
  // The alert is already saved and validated. Timestamp failures must not hide that success.
  try {
    await heartbeat();
  } catch {
    console.warn("Help request saved; last_seen refresh failed");
  }
  return {
    device_id: row.device_id,
    event_id: event.event_id,
    kind: event.kind,
    received_at: row.received_at,
    acknowledged_at: row.acknowledged_at,
  };
}));
