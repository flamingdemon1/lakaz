/**
 * ZoneMap.tsx — PHONE map for safe zones (react-native-maps, works in Expo Go):
 * draws every zone as a circle, the person's position as a pin, and reports taps (to place a zone).
 * Owner: Person 3/4 (Zuhayr). The web build uses ZoneMap.web.tsx (Leaflet). Keep both props identical.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import type { LatLng } from '@/lib/geo';
import { colors, radius } from '@/theme';

export interface ZoneMapZone {
  id: string;
  center: LatLng;
  radius: number;
  label: string;
  /** Highlighted zone (being edited) is drawn darker. */
  selected?: boolean;
}

export interface ZoneMapProps {
  zones: ZoneMapZone[];
  /** Where the map is centred. */
  focus: LatLng;
  /** The person's (SAMPLE) position, if known. */
  person?: LatLng | null;
  /** Called with the tapped point — used by the zone editor to move the centre. */
  onPress?: (p: LatLng) => void;
  height?: number;
  /** Zoom level as map span in degrees (smaller = closer). */
  span?: number;
}

/** Map with zone circles. */
export function ZoneMap({ zones, focus, person, onPress, height = 260, span = 0.012 }: ZoneMapProps) {
  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={{ latitude: focus.lat, longitude: focus.lng, latitudeDelta: span, longitudeDelta: span }}
        onPress={onPress ? (e) => onPress({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude }) : undefined}
        toolbarEnabled={false}
        accessibilityLabel={`Map with ${zones.length} safe zone${zones.length === 1 ? '' : 's'}`}>
        {zones.map((z) => (
          <Circle
            key={z.id}
            center={{ latitude: z.center.lat, longitude: z.center.lng }}
            radius={z.radius}
            strokeColor={z.selected ? colors.primary : 'rgba(14,116,144,0.7)'}
            strokeWidth={z.selected ? 3 : 2}
            fillColor={z.selected ? 'rgba(14,116,144,0.22)' : 'rgba(14,116,144,0.10)'}
          />
        ))}
        {zones.map((z) => (
          <Marker key={`m-${z.id}`} coordinate={{ latitude: z.center.lat, longitude: z.center.lng }} title={z.label} pinColor="teal" />
        ))}
        {person ? (
          <Marker coordinate={{ latitude: person.lat, longitude: person.lng }} title="Person (sample position)" pinColor="red" />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.muted },
});
