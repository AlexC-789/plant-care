import { StyleSheet, View } from 'react-native';

import { space } from '@/theme';
import { InsetGroup, Row, Text } from '@/ui';

import type { Device } from './api';
import { soilLabel, timeLabel, waterLabel } from './status';
import { TankVessel } from './TankVessel';

/** The module's readings; with no device (load failed, nothing cached) every value is "—". */
export function ModuleCard({ device }: { device: Device | null }) {
  const battery = device?.battery_pct == null ? '—' : `${device.battery_pct} %${device.charging ? ' · Charging' : ''}`;
  return (
    <InsetGroup header="Module">
      <Row label="Water" value={device ? undefined : '—'}>
        {device ? (
          <View style={styles.water}>
            <TankVessel ml={device.float_low ? 0 : device.water_left_ml} fullMl={device.tank_full_ml} width={18} />
            <Text color="secondaryLabel">{waterLabel(device)}</Text>
          </View>
        ) : undefined}
      </Row>
      <Row label="Soil" value={device ? soilLabel(device.soil_pct) : '—'} />
      <Row label="Battery" value={battery} />
      <Row label="Checked in" value={device?.last_seen_at ? timeLabel(device.last_seen_at, new Date()) : '—'} />
    </InsetGroup>
  );
}

const styles = StyleSheet.create({
  water: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.s },
});
