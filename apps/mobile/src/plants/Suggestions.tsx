import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/theme';
import { Button, Icon, Text } from '@/ui';

import type { IdentifyResult } from './api';

type Suggestion = IdentifyResult['suggestions'][number];
const WORDS = { very_likely: 'Very likely', likely: 'Likely', possibly: 'Possibly' } as const;

/** "Is it one of these?": tapping a row picks and applies it; top pick preselected only when "Very likely"; never percentages. */
export function Suggestions({
  suggestions,
  onPick,
  onSearch,
}: {
  suggestions: Suggestion[];
  onPick: (s: Suggestion) => void;
  onSearch: () => void;
}) {
  const { colors } = useTheme();
  const [picked, setPicked] = useState(suggestions[0]?.confidence === 'very_likely' ? 0 : -1);
  return (
    <View style={styles.list}>
      <Text variant="title3" accessibilityRole="header">
        Is it one of these?
      </Text>
      {suggestions.map((s, i) => (
        <Pressable
          key={s.speciesId}
          accessibilityRole="button"
          accessibilityLabel={`${s.commonName}, ${s.scientificName}, ${WORDS[s.confidence]}`}
          accessibilityState={{ selected: i === picked }}
          onPress={() => {
            setPicked(i);
            onPick(s);
          }}
          style={[styles.row, { backgroundColor: colors.surface }]}>
          <View style={styles.text}>
            <Text variant="headline">{s.commonName}</Text>
            <Text variant="subheadline" color="secondaryLabel">
              {s.scientificName} · {WORDS[s.confidence]}
            </Text>
          </View>
          {i === picked ? <Icon name="checkmark" size={18} color="tint" /> : null}
        </Pressable>
      ))}
      <Button label="None of these, search instead" variant="plain" onPress={onSearch} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, padding: space.l, borderRadius: radius.group },
  text: { flex: 1 },
});
