// Request boundary for the device-event Edge Function. The entrypoint will
// supply a database-backed submit function once the shared SQL is ready.
type DeviceEvent = { event_id: string; kind: "help_requested" | "heartbeat" };
type StoredAlert = DeviceEvent & {
  device_id: string;
  received_at: string;
  acknowledged_at: string | null;
};
type SubmitEvent = (token: string, event: DeviceEvent) => Promise<StoredAlert | { ok: true } | null>;

const maxBytes = 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function error(status: number, code: string, headers?: HeadersInit) {
  return Response.json({ error: code }, { status, headers });
}

export function createDeviceEventHandler(submit: SubmitEvent) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return error(405, "method_not_allowed", { Allow: "POST" });
    }

    const token = /^Bearer ([A-Za-z0-9._~+/-]{1,256}={0,2})$/i.exec(
      request.headers.get("authorization") ?? "",
    )?.[1];
    if (!token) return error(401, "unauthorized");

    const mediaType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (mediaType !== "application/json") return error(415, "expected_json");

    const reader = request.body?.getReader();
    if (!reader) return error(400, "invalid_json");

    let payload: unknown;
    try {
      const bytes = new Uint8Array(maxBytes);
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (length + value.byteLength > maxBytes) {
          void reader.cancel().catch(() => {});
          return error(413, "payload_too_large");
        }
        bytes.set(value, length);
        length += value.byteLength;
      }
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)));
    } catch {
      return error(400, "invalid_json");
    } finally {
      reader.releaseLock();
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return error(400, "invalid_event");
    }
    const { event_id, kind } = payload as Record<string, unknown>;
    if (Object.keys(payload).length !== 2 || typeof event_id !== "string" ||
        !uuid.test(event_id) || (kind !== "help_requested" && kind !== "heartbeat")) {
      return error(400, "invalid_event");
    }

    try {
      const alert = await submit(token, { event_id: event_id.toLowerCase(), kind });
      return alert ? Response.json(alert, { headers: { "Cache-Control": "no-store" } }) :
        error(401, "unauthorized");
    } catch {
      return error(500, "intake_failed");
    }
  };
}
