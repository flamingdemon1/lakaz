/**
 * LocationMap.tsx — PHONE version of the map (react-native-maps, works in Expo Go).
 * Owner: Person 3/4 (Fahim, Zuhayr).
 * The web build automatically uses LocationMap.web.tsx instead (Leaflet), because
 * react-native-maps does not run in a browser. Both files must keep the same props.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { colors, radius, statusStyles } from '@/theme';

export interface LocationMapProps {
  lat: number;
  lng: number;
  /** Fresh = fix < 60 s old. Stale fixes are drawn grey so nobody mistakes them for live. */
  fresh: boolean;
  height?: number;
  /** Optional home point, drawn as a 50 m circle (home zone z-home, section 7.5). */
  home?: { lat: number; lng: number };
}

/** Shows one pin at the last known location, and the home zone if given. */
export function LocationMap({ lat, lng, fresh, height = 200, home }: LocationMapProps) {
  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        // Why `region` (not initialRegion): the map follows the person as new fixes arrive.
        region={{ latitude: lat, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
        toolbarEnabled={false}
        accessibilityLabel={`Map showing last known location ${fresh ? '' : '(not fresh)'}`}>
        {home ? (
          <Circle
            center={{ latitude: home.lat, longitude: home.lng }}
            radius={50}
            strokeColor={colors.primary}
            fillColor="rgba(14,116,144,0.12)"
          />
        ) : null}
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          pinColor={fresh ? statusStyles.Critical.bg : colors.offline}
          title={fresh ? 'Last location' : 'Last known location (old)'}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.muted },
});
