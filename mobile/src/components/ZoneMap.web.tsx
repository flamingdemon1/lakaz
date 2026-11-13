/**
 * ZoneMap.web.tsx — WEB map for safe zones (Leaflet + OpenStreetMap). Same props as ZoneMap.tsx.
 * Owner: Person 3/4 (Zuhayr).
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import React, { useEffect, useRef } from 'react';

import { colors, radius, statusStyles } from '@/theme';

import type { ZoneMapProps } from './ZoneMap';

/** Converts the "span" (degrees) used on phones into a Leaflet zoom level. */
const zoomFor = (span: number) => Math.round(Math.log2(360 / span)) - 1;

/** Map with zone circles. */
export function ZoneMap({ zones, focus, person, onPress, height = 260, span = 0.012 }: ZoneMapProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pressRef = useRef(onPress);
  pressRef.current = onPress;

  // Create the map once.
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current).setView([focus.lat, focus.lng], zoomFor(span));
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    // Why a ref: the click handler is attached once, but must call the newest onPress.
    map.on('click', (e: L.LeafletMouseEvent) => pressRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw circles + pins whenever zones or the person move.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    zones.forEach((z) => {
      L.circle([z.center.lat, z.center.lng], {
        radius: z.radius,
        color: colors.primary,
        weight: z.selected ? 3 : 2,
        fillOpacity: z.selected ? 0.22 : 0.1,
      })
        .bindTooltip(z.label, { permanent: true, direction: 'top', offset: [0, -4] })
        .addTo(layer);
    });
    if (person) {
      // Why circleMarker: Leaflet's default pin images break under bundlers.
      L.circleMarker([person.lat, person.lng], { radius: 9, weight: 3, color: '#fff', fillColor: statusStyles.Critical.bg, fillOpacity: 1 })
        .bindTooltip('Sample position')
        .addTo(layer);
    }
  }, [zones, person]);

  // Follow the focus point (e.g. after picking a preset).
  useEffect(() => {
    mapRef.current?.panTo([focus.lat, focus.lng]);
  }, [focus.lat, focus.lng]);

  return (
    <div
      ref={divRef}
      role="img"
      aria-label={`Map with ${zones.length} safe zone${zones.length === 1 ? '' : 's'}${onPress ? '. Click to move the zone centre.' : ''}`}
      style={{ width: '100%', height, borderRadius: radius.md, overflow: 'hidden', background: colors.muted, cursor: onPress ? 'crosshair' : 'grab' }}
    />
  );
}
