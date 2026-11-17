import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Species } from '@/plants/api';
import { radius, space, useTheme } from '@/theme';
import { Button, Text } from '@/ui';

const LIGHT: Record<string, string> = {
  bright_indirect: 'Bright, indirect light',
  medium: 'Medium light',
  low: 'Low light',
  direct: 'Direct sun',
};

// shortcut: "More" is offered by length, not by measuring the text, so a short wrapped line may show it; fine until a design review says otherwise.
const LONG = 120;

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
      {description ? (
        <>
          <Text variant="subheadline" numberOfLines={open ? undefined : 3}>
            {description}
          </Text>
          {!open && description.length > LONG ? <Button label="More" variant="plain" onPress={() => setOpen(true)} /> : null}
        </>
      ) : null}
      {light ? <Text variant="subheadline">{LIGHT[light] ?? light}</Text> : null}
      {watering ? <Text variant="subheadline">{watering}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({ card: { borderRadius: radius.group, padding: space.l, gap: space.s } });
