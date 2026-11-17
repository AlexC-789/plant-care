import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { pickSpecies } from './api';
import type { Species } from './addDraft';
import { useSpeciesSearch } from './queries';
import { radius, space, typography, useTheme } from '@/theme';
import { FadeIn, LoadingGroup, Row, SkeletonRow, Text } from '@/ui';

type Item =
  | { key: string; label: string; onPress: () => void }
  | { key: string; header: string };

/** Search box + results for a plant type; `onPick` gets a known species or `{custom}` text. */
export function TypeSearch({ onPick: choose }: { onPick: (species: Species) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const { data, isPending, isError } = useSpeciesSearch(term);

  const pickMore = async (commonName: string, scientificName: string) => {
    try {
      choose({ id: await pickSpecies(scientificName), name: commonName });
    } catch {
      setFailed(true);
    }
  };

  const local = data?.local ?? [];
  const more = data?.more ?? [];
  const items: Item[] = [
    ...local.map((s) => {
      const name = s.common_names?.[0] ?? s.scientific_name;
      return { key: s.id, label: `${name} — ${s.scientific_name}`, onPress: () => choose({ id: s.id, name }) };
    }),
    ...(more.length ? [{ key: 'more', header: 'More plants' }] : []),
    ...more.map((h) => ({
      key: h.scientificName,
      label: `${h.commonName} — ${h.scientificName}`,
      onPress: () => void pickMore(h.commonName, h.scientificName),
    })),
  ];
  if (term && !isPending && !items.length) {
    items.push({ key: 'custom', label: `Use “${term}” as the type`, onPress: () => choose({ custom: term }) });
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            accessibilityLabel="Search plants"
            placeholder="Search plants"
            placeholderTextColor={colors.secondaryLabel}
            style={[styles.input, typography.body, { color: colors.label, backgroundColor: colors.surface }]}
            value={text}
            onChangeText={setText}
            autoFocus
            autoCorrect={false}
            maxLength={60}
          />
          {isError ? (
            <Text variant="footnote" color="secondaryLabel">
              {"Couldn't search right now."}
            </Text>
          ) : null}
          {failed ? (
            <Text variant="footnote" color="statusNow" accessibilityRole="alert">
              {"Couldn't add that plant. Try again."}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        term && isPending ? (
          <LoadingGroup>
            <SkeletonRow />
            <SkeletonRow />
          </LoadingGroup>
        ) : undefined
      }
      renderItem={({ item }) =>
        'header' in item ? (
          <Text variant="subheadline" color="secondaryLabel" accessibilityRole="header" style={styles.section}>
            {item.header}
          </Text>
        ) : (
          <FadeIn>
            <View style={{ backgroundColor: colors.surface }}>
              <Row label={item.label} accessory="chevron" onPress={item.onPress} />
            </View>
          </FadeIn>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.l },
  header: { gap: space.s, marginBottom: space.m },
  input: { minHeight: space.touch, paddingHorizontal: space.l, borderRadius: radius.group },
  section: { marginTop: space.l, marginBottom: space.s, marginHorizontal: space.xs },
});
