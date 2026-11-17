import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Species } from '@/plants/api';
import { radius, space, useTheme } from '@/theme';
import { Icon, Text, TextLink, type IconName } from '@/ui';

const LIGHT: Record<string, string> = {
  bright_indirect: 'Bright, indirect light',
  medium: 'Medium light',
  low: 'Low light',
  direct: 'Direct sun',
};

// shortcut: "More" is offered by length, not by measuring the text, so a short wrapped line may show it; fine until a design review says otherwise.
const LONG = 120;

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={22} color="tint" />
      <View style={styles.factText}>
        <Text variant="footnote" color="secondaryLabel">
          {label}
        </Text>
        <Text variant="subheadline">{value}</Text>
      </View>
    </View>
  );
}

/** Species facts. Renders nothing when the species has none (custom types never reach here). */
export function AboutPlant({ species }: { species: Species }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const { description, light, watering } = species;
  if (!description && !light && !watering) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text variant="headline" accessibilityRole="header">
        About this plant
      </Text>
      {light ? <Fact icon="light" label="Light" value={LIGHT[light] ?? light} /> : null}
      {watering ? <Fact icon="water" label="Watering" value={watering} /> : null}
      {description ? (
        <>
          <Text variant="subheadline" numberOfLines={open ? undefined : 3}>
            {description}
          </Text>
          {description.length > LONG ? (
            <TextLink label={open ? 'Less' : 'More'} onPress={() => setOpen((o) => !o)} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.group, padding: space.l, gap: space.m },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  factText: { flex: 1 },
});
