import { Pressable, StyleSheet, View } from 'react-native';

import { fonts, radius, space, useTheme } from '@/theme';
import { Button, Icon, Text } from '@/ui';

import type { IdentifyResult } from './api';

type Suggestion = IdentifyResult['suggestions'][number];
/** Confidence in words (SCREEN_SPECIFICATIONS §3); the server's cutoffs stay 0.7 / 0.35. */
export const WORDS = { very_likely: 'Very likely', likely: 'Probably', possibly: 'Might be' } as const;

/** "Is it one of these?": tapping a row picks it (`selected` is the applied species id); never percentages. */
export function Suggestions({
  suggestions,
  selected,
  onPick,
  onSearch,
}: {
  suggestions: Suggestion[];
  selected?: string;
  onPick: (s: Suggestion) => void;
  onSearch: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.list}>
      <Text variant="title" accessibilityRole="header">
        Is it one of these?
      </Text>
      {suggestions.map((s) => (
        <Pressable
          key={s.speciesId}
          accessibilityRole="button"
          accessibilityLabel={`${s.commonName}, ${s.scientificName}, ${WORDS[s.confidence]}`}
          accessibilityState={{ selected: s.speciesId === selected }}
          onPress={() => onPick(s)}
          style={[styles.row, { backgroundColor: colors.surface }]}>
          <View style={styles.text}>
            <Text variant="headline">{s.commonName}</Text>
            <Text variant="subheadline" color="secondaryLabel" style={{ fontFamily: fonts.italic }}>
              {s.scientificName}
            </Text>
            <Text variant="footnote" color="secondaryLabel">
              {WORDS[s.confidence]}
            </Text>
          </View>
          {s.speciesId === selected ? <Icon name="checkmark" size={18} color="tint" /> : null}
        </Pressable>
      ))}
      <Button label="Search by name" variant="plain" onPress={onSearch} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.l, borderRadius: radius.group },
  text: { flex: 1 },
});
