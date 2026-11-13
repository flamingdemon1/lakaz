/** Home/away and last event reported by a linked band. Owner: Fahim. */
import React from 'react';
import { View } from 'react-native';
import { AppText, Card } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { useBand } from '@/data/bands';
import { fill } from '@/i18n';
import { clock, timeAgo } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { colors, space } from '@/theme';

/** Input: optional band UUID. Renders event-based reports without inferring a continuous connection. */
export function BandStatus({ deviceId }: { deviceId?: string }) {
  const { band, loading, error } = useBand(deviceId);
  const { t } = useAuth();
  const now = useNow(1000);
  const home = band?.home_state === 'home';
  const away = band?.home_state === 'away';
  // Missing timestamps must stay unknown instead of rendering Invalid Date or a made-up time.
  const since = band?.home_since && Number.isFinite(Date.parse(band.home_since))
    ? clock(band.home_since) : t('bandTimeUnknown');
  const heard = band?.last_seen && Number.isFinite(Date.parse(band.last_seen));
  let state = t('bandHomeUnknown');
  if (home) state = fill(t('bandHomeSince'), { time: since });
  if (away) state = fill(t('bandAwaySince'), { time: since });
  const second = heard ? fill(t('bandLastHeard'), { ago: timeAgo(band!.last_seen, now) }) : t('bandNotHeard');
  const color = home ? colors.safe : away ? colors.warning : colors.textMuted;
  if (loading) state = t('bandChecking');
  else if (error) state = t('bandReportError');
  else if (!band) state = t('bandNotLinked');
  const title = band?.label ?? t('band');
  return (
    <Card>
      <View accessible accessibilityLabel={title + '. ' + state + '. ' + second} accessibilityLiveRegion="polite" style={{ gap: space.sm }}>
        <AppText variant="bodyBold">{title}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View accessibilityElementsHidden style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <AppText color={color} style={{ flex: 1 }}>{state}</AppText>
        </View>
        <AppText variant="small" color={colors.textMuted}>{second}</AppText>
      </View>
      <AppText variant="small" color={colors.textMuted}>{t('bandEventNote')}</AppText>
    </Card>
  );
}
