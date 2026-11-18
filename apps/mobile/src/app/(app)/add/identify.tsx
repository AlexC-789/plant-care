import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { deletePhotos } from '@/plants/photos';
import { typeName, useAddDraft } from '@/plants/addDraft';
import { useIdentify } from '@/plants/queries';
import { Suggestions } from '@/plants/Suggestions';
import { space } from '@/theme';
import { BottomBar, Button, StepDone, StepProgress, Text, TextLink } from '@/ui';

const COULDNT = "Couldn't tell from this photo. Try one with a whole leaf in view, or search.";
// The server's own message for a 429; any other failure reads as "couldn't tell".
const LIMIT = "You've reached the identification limit for now. Search for the plant type, or try again later.";

/** Step 2 of 4: what kind of plant. Never blocks Continue. */
export default function IdentifyStep() {
  const router = useRouter();
  const { draft, set } = useAddDraft();
  const identify = useIdentify();
  const [message, setMessage] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);

  const { species } = draft;
  const type = typeName(draft);
  // A names-only pick has no common name, so its title already is the scientific name.
  const scientific = species && 'id' in species && species.scientific !== type ? species.scientific : undefined;
  const hasWhole = draft.photos.some((p) => p.kind === 'whole');

  const apply = (s: { speciesId: string; commonName: string; scientificName: string }) =>
    set({ species: { id: s.speciesId, name: s.commonName, scientific: s.scientificName } });

  const runIdentify = () => {
    setMessage(null);
    identify.mutate(
      // The problem photo is for the health check only; identify takes whole, leaf and flower.
      draft.photos.filter((p) => p.kind !== 'problem').map((p) => p.path),
      {
        onSuccess: (r) => {
          if (r.isPlant && r.suggestions.length) {
            set({ scanId: r.scanId, suggestions: r.suggestions.slice(0, 3) });
            if (r.suggestions[0].confidence === 'very_likely') apply(r.suggestions[0]);
          } else setMessage(COULDNT);
        },
        onError: (e) => setMessage(e.message === LIMIT ? LIMIT : COULDNT),
      },
    );
  };

  const cancel = () => {
    void deletePhotos(draft.photos.map((p) => p.path)).catch(() => {});
    router.dismissTo('/');
  };

  // The plant is saved: going back here must not touch its photos.
  if (draft.plantId) return <Redirect href="/add/health" />;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ headerRight: () => <TextLink label="Cancel" onPress={cancel} /> }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <StepProgress step={2} />
        <Text variant="title" accessibilityRole="header">
          What kind of plant is it?
        </Text>
        {hasWhole && !draft.scanId ? (
          <Button
            label="Identify from my photo"
            variant="bordered"
            busy={identify.isPending}
            disabled={identify.isPending}
            onPress={runIdentify}
          />
        ) : null}
        <Button label="I know it — search" variant="bordered" onPress={() => router.push('/add/search')} />
        {message ? (
          <Text variant="footnote" color="statusNow" accessibilityRole="alert">
            {message}
          </Text>
        ) : null}
        {draft.suggestions?.length ? (
          <Suggestions
            suggestions={draft.suggestions}
            selected={species && 'id' in species ? species.id : undefined}
            onPick={apply}
            onSearch={() => router.push('/add/search')}
          />
        ) : null}
        {type ? (
          <StepDone title={`It's a ${type}.`}>
            {scientific ? (
              <Text variant="subheadline" color="secondaryLabel">
                {scientific}
              </Text>
            ) : null}
          </StepDone>
        ) : (
          <>
            {skipped ? <Text color="secondaryLabel">Not sure? You can set it later.</Text> : null}
            <Button label="Skip" variant="plain" onPress={() => setSkipped(true)} />
          </>
        )}
      </ScrollView>
      <BottomBar>
        <Button label="Continue" disabled={identify.isPending} onPress={() => router.push('/add/where')} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.l, gap: space.l },
});
