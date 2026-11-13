/**
 * api.ts — tiny REST client for the LAKAZ backend (endpoints from section 7.3).
 * Owner: Person 3 (Fahim, Zuhayr). Never rename paths — they are the shared contract.
 */
import { API_URL } from '@/config';
import type { Alert, Device, DeviceStatus } from '@/types';

/**
 * Calls the backend and returns parsed JSON. Throws a readable Error on failure.
 * Why the 5 s timeout: on a bad hotspot a request can hang forever and freeze the loading spinner.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`Server replied ${res.status} for ${path}`);
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`No reply from ${API_URL} after 5 s`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/alerts — all alerts. If the backend only supports the filtered form,
 * falls back to GET /api/alerts?status=Active (the form written in section 7.3).
 */
export async function fetchAlerts(): Promise<Alert[]> {
  try {
    return await request<Alert[]>('/api/alerts');
  } catch {
    return request<Alert[]>('/api/alerts?status=Active');
  }
}

/** GET /api/devices/:id/status → { status, person_name, since, level } */
export const fetchStatus = (deviceId: string) =>
  request<DeviceStatus>(`/api/devices/${encodeURIComponent(deviceId)}/status`);

/** GET /api/devices → list of devices (shape assumed, see types.ts). */
export const fetchDevices = () => request<Device[]>('/api/devices');

/**
 * POST /api/alerts/:id/ack — "I've got it".
 * Body field name `acknowledged_by` reuses the alert field from 7.2 — CONFIRM with backend.
 */
export const ackAlert = (id: string, caregiverId: string) =>
  request<Alert>(`/api/alerts/${encodeURIComponent(id)}/ack`, {
    method: 'POST',
    body: JSON.stringify({ acknowledged_by: caregiverId }),
  });

/** POST /api/alerts/:id/resolve — person is safe. */
export const resolveAlert = (id: string) =>
  request<Alert>(`/api/alerts/${encodeURIComponent(id)}/resolve`, { method: 'POST' });
