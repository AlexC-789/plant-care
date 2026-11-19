import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { radius, space, useTheme } from '@/theme';
import { Button, Text } from '@/ui';

import { deletePhotos, preparePhoto, uploadPhoto } from './photos';
import { DENIED, pickPhoto, type PhotoSource } from './pickPhoto';

export type Photo = { kind: string; localUri: string; path: string };
export type CaptureCard = { kind: string; title: string; hint: string; optional?: boolean };

export const ADD_CARDS: CaptureCard[] = [
  { kind: 'whole', title: 'Whole plant', hint: 'Step back so the whole plant and pot fit' },
  { kind: 'leaf', title: 'One leaf', hint: 'Fill the frame with one healthy leaf', optional: true },
  { kind: 'flower', title: 'Flower', hint: "If it's flowering", optional: true },
  { kind: 'problem', title: 'Problem spot', hint: 'If something looks wrong', optional: true },
];

/**
 * One card per `cards` entry. A photo is resized and uploaded as soon as it is taken or chosen;
 * replacing or removing one deletes its upload. `onChange` gets the new full list.
 */
export function CaptureCards({
  cards,
  photos,
  onChange,
}: {
  cards: CaptureCard[];
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
}) {
  const { colors } = useTheme();
  const userId = useSession().session?.user.id;
  const [denied, setDenied] = useState<PhotoSource | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const remove = (kind: string) => {
    const old = photos.find((p) => p.kind === kind);
    if (old) void deletePhotos([old.path]).catch(() => {});
    return photos.filter((p) => p.kind !== kind);
  };

  async function pick(kind: string, source: PhotoSource) {
    setFailed(false);
    try {
      const picked = await pickPhoto(source);
      if (picked.denied) return setDenied(source);
      setDenied(null);
      if (!picked.uri || !userId) return;
      setBusy(kind);
      const prepared = await preparePhoto(picked.uri);
      const path = await uploadPhoto(userId, prepared);
      onChange([...remove(kind), { kind, localUri: prepared.uri, path }]);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.list}>
      {cards.map(({ kind, title, hint, optional }) => {
        const photo = photos.find((p) => p.kind === kind);
        const isSkipped = skipped.includes(kind) && !photo;
        return (
          <View key={kind} style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text variant="headline" accessibilityRole="header">
              {title}
            </Text>
            <Text variant="subheadline" color="secondaryLabel">
              {hint}
            </Text>
            {photo ? (
              <Image
                accessibilityLabel={`${title} photo`}
                source={{ uri: photo.localUri }}
                style={styles.thumb}
              />
            ) : null}
            {isSkipped ? (
              <Button
                label="Add photo"
                variant="line"
                onPress={() => setSkipped(skipped.filter((k) => k !== kind))}
              />
            ) : (
              <>
                <Button
                  label="Take photo"
                  variant="line"
                  busy={busy === kind}
                  disabled={busy !== null}
                  onPress={() => void pick(kind, 'camera')}
                />
                <Button
                  label="Choose from library"
                  variant="line"
                  disabled={busy !== null}
                  onPress={() => void pick(kind, 'library')}
                />
                {photo ? (
                  <Button label="Remove" variant="plain" destructive onPress={() => onChange(remove(kind))} />
                ) : optional ? (
                  <Button label="Skip" variant="plain" onPress={() => setSkipped([...skipped, kind])} />
                ) : null}
              </>
            )}
          </View>
        );
      })}
      {denied ? (
        <View style={styles.row}>
          <Text variant="footnote" color="secondaryLabel">
            {DENIED[denied]}
          </Text>
          <Button label="Open Settings" variant="plain" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
      {failed ? (
        <Text variant="footnote" color="statusNow" accessibilityRole="alert">
          {"Couldn't add that photo. Try again."}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.l },
  card: { borderRadius: radius.group, padding: space.l, gap: space.s },
  thumb: { height: 160, borderRadius: radius.thumb },
  row: { gap: space.xs },
});
