import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { type Species, useAddDraft } from '@/plants/addDraft';
import { useIdentify, useSpecies } from '@/plants/queries';
import { Suggestions, WORDS } from '@/plants/Suggestions';
import { fonts, space } from '@/theme';
import { BottomBar, Button, FadeIn, HeroPhoto, LoadingGroup, SkeletonText, Text } from '@/ui';

const COULDNT = "Couldn't tell what this is.";
// The server's message for a 429. The limit counts identify and health calls over 24 h, so the copy says no number.
const SERVER_LIMIT = "You've reached the identification limit for now. Search for the plant type, or try again later.";
const LIMIT = "You've reached today's limit for identifying plants. Try again tomorrow, or search by name.";

/** Result: identifies the capture once, shows the best match large, "This is my plant" or "It's something else". */
export default function ResultStep() {
  const router = useRouter();
  const { draft, set } = useAddDraft();
  const identify = useIdentify();
  const [message, setMessage] = useState<string | null>(null);
  const [others, setOthers] = useState(false);
  const started = useRef(false); // one identify per capture: a remount comes with a new capture

  const { capture, suggestions } = draft;
  useEffect(() => {
    if (!capture || suggestions || started.current) return;
    started.current = true;
    identify.mutate([capture.path], {
      onSuccess: (r) =>
        r.isPlant && r.suggestions.length
          ? set({ scanId: r.scanId, suggestions: r.suggestions.slice(0, 3) })
          : setMessage(COULDNT),
      onError: (e) => setMessage(e.message === SERVER_LIMIT ? LIMIT : COULDNT),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once on mount
  }, []);

  const top = suggestions?.[0];
  // The person's pick (an alternative or a search result) wins over the top match.
  const shown: Species | undefined =
    draft.species ?? (top && { id: top.speciesId, name: top.commonName, scientific: top.scientificName });
  const shownId = shown && 'id' in shown ? shown.id : undefined;
  const match = suggestions?.find((s) => s.speciesId === shownId);
  const name = !shown ? undefined : 'custom' in shown ? shown.custom : shown.name || shown.scientific;
  const latin = shown && 'id' in shown && shown.scientific !== name ? shown.scientific : undefined;
  const care = useSpecies(shownId);
  const listOthers = !!suggestions && (others || top?.confidence === 'possibly');

  const search = () => {
    setOthers(false); // a search pick comes back as the result itself
    router.push('/add/search');
  };
  const pick = (s: NonNullable<typeof top>) => {
    set({ species: { id: s.speciesId, name: s.commonName, scientific: s.scientificName } });
    setOthers(false);
  };

  // The plant is saved: going back here must not touch its photo.
  if (draft.plantId) return <Redirect href="/add/health" />;
  if (!capture) return <Redirect href="/add/capture" />;

  return (
    <View style={styles.flex}>
      <ScrollView contentInsetAdjustmentBehavior="never">
        <HeroPhoto uri={capture.localUri} label="Your plant" loading={false} pills={[]} height={360} onBack={() => router.back()} />
        <View style={styles.content}>
          {name ? (
            <FadeIn>
              <View style={styles.text}>
                {match ? <Text variant="footnote" color="secondaryLabel">{WORDS[match.confidence]}</Text> : null}
                <Text variant="display" accessibilityRole="header">
                  {name}
                </Text>
                {latin ? (
                  <Text variant="subheadline" color="secondaryLabel" style={{ fontFamily: fonts.italic }}>
                    {latin}
                  </Text>
                ) : null}
                {care.isLoading ? (
                  <LoadingGroup>
                    <SkeletonText width="90%" />
                  </LoadingGroup>
                ) : care.data?.description ? (
                  <FadeIn>
                    <Text style={styles.care}>{care.data.description}</Text>
                  </FadeIn>
                ) : null}
              </View>
            </FadeIn>
          ) : message ? (
            <Text variant="title" accessibilityRole="alert">
              {message}
            </Text>
          ) : (
            <LoadingGroup>
              <SkeletonText variant="footnote" width="25%" />
              <SkeletonText variant="display" width="70%" />
              <SkeletonText variant="subheadline" width="45%" />
            </LoadingGroup>
          )}
          {listOthers ? <Suggestions suggestions={suggestions} selected={shownId} onPick={pick} onSearch={search} /> : null}
        </View>
      </ScrollView>
      <BottomBar>
        {name || !message ? (
          <>
            <Button
              label="This is my plant"
              disabled={!shown}
              onPress={() => {
                set({ species: shown });
                router.push('/add/where');
              }}
            />
            <Button label="It's something else" variant="plain" onPress={() => (suggestions ? setOthers(true) : search())} />
          </>
        ) : (
          <>
            <Button label="Try another photo" onPress={() => router.back()} />
            <Button label="Search by name" variant="plain" onPress={search} />
          </>
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xl, gap: space.xl },
  text: { gap: space.xs },
  care: { marginTop: space.s },
});
