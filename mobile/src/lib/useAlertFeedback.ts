/**
 * useAlertFeedback.ts — sound + vibration when an alert arrives.
 * Owner: Person 3/4 (Zuhayr).
 *
 * Why not push notifications: remote push does not work in Expo Go, so the in-app alert
 * (this) + WhatsApp are our notification channels. Alerts only appear while the app is open.
 */
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Vibration } from 'react-native';

const ALERT_SOUND = require('../../assets/sounds/alert.wav');

/**
 * Returns `play()` to sound the alert, plus `needsTap` / `unlock()` for the web.
 * Why `needsTap`: browsers block audio until the user taps the page once.
 */
export function useAlertFeedback() {
  const player = useAudioPlayer(ALERT_SOUND);
  const [needsTap, setNeedsTap] = useState(Platform.OS === 'web');

  useEffect(() => {
    // Why: on iPhone the ring/silent switch would otherwise mute our alarm.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  /** Plays the chime and vibrates. Never throws — a missing sound must not break the alert screen. */
  const play = useCallback(() => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      /* ignore — sound is a bonus, the visual alert is what matters */
    }
    if (Platform.OS === 'android') Vibration.vibrate([0, 400, 150, 400]);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [player]);

  /** Call from a button press on web: plays once (quietly allowed now) and marks sound as enabled. */
  const unlock = useCallback(() => {
    play();
    setNeedsTap(false);
  }, [play]);

  return { play, needsTap, unlock };
}
