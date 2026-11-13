/**
 * LocationMap.web.tsx — WEB version of the map (Leaflet + OpenStreetMap tiles).
 * Owner: Person 3/4 (Fahim, Zuhayr).
 * Expo picks this file automatically on web (the ".web" suffix). Same props as LocationMap.tsx.
 * Needs internet for the map tiles; if tiles fail, the pin and coordinates still show.
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import React, { useEffect, useRef } from 'react';

import { colors, radius, statusStyles } from '@/theme';

import type { LocationMapProps } from './LocationMap';

/** Shows one pin at the last known location, and the home zone if given. */
export function LocationMap({ lat, lng, fresh, height = 200, home }: LocationMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinRef = useRef<L.CircleMarker | null>(null);

  // Create the map once.
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true, attributionControl: true }).setView([lat, lng], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    if (home) {
      // Home zone z-home: 50 m radius (section 7.5).
      L.circle([home.lat, home.lng], { radius: 50, color: colors.primary, weight: 2, fillOpacity: 0.12 }).addTo(map);
    }
    // Why circleMarker instead of the default pin: Leaflet's pin images break under bundlers.
    pinRef.current = L.circleMarker([lat, lng], { radius: 10, weight: 3, color: '#fff', fillOpacity: 1 }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the pin (and recolour it) whenever a new fix arrives.
  useEffect(() => {
    pinRef.current?.setLatLng([lat, lng]);
    pinRef.current?.setStyle({ fillColor: fresh ? statusStyles.Critical.bg : colors.offline });
    mapRef.current?.panTo([lat, lng]);
  }, [lat, lng, fresh]);

  return (
    <div
      ref={divRef}
      role="img"
      aria-label={`Map showing last known location${fresh ? '' : ' (not fresh)'}`}
      style={{ width: '100%', height, borderRadius: radius.md, overflow: 'hidden', background: colors.muted }}
    />
  );
}
