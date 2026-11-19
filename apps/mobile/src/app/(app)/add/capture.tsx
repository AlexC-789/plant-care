import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import { useSession } from '@/auth/AuthProvider';
import { useAddDraft } from '@/plants/addDraft';
import { CaptureView } from '@/plants/CaptureView';
import { deletePhotos, preparePhoto, uploadPhoto } from '@/plants/photos';

/** Capture: the camera opens at once; a photo is re-encoded, uploaded, then identified on the next screen. */
export default function CaptureStep() {
  const router = useRouter();
  const userId = useSession().session?.user.id;
  const { draft, set } = useAddDraft();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const working = useRef(false); // two shutter taps in one frame upload one photo
  const closed = useRef(false); // Close during an upload: that upload is deleted when it lands

  async function use(uri: string) {
    if (!userId || working.current) return;
    working.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const prepared = await preparePhoto(uri);
      const path = await uploadPhoto(userId, prepared);
      if (closed.current) return void deletePhotos([path]).catch(() => {});
      if (draft.capture) void deletePhotos([draft.capture.path]).catch(() => {});
      // A new photo makes the earlier identification stale.
      set({ capture: { localUri: prepared.uri, path }, scanId: undefined, suggestions: undefined, species: undefined });
      router.push('/add/identify');
    } catch {
      setFailed(true);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  const close = () => {
    closed.current = true;
    if (draft.capture) void deletePhotos([draft.capture.path]).catch(() => {});
    router.back();
  };
  // Android back would pop the whole flow past Close: route it through Close, only while this screen
  // is focused (it stays mounted under Result and Name and place).
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web' || draft.plantId) return; // react-native-web's BackHandler throws
      const sub = BackHandler.addEventListener('hardwareBackPress', () => (close(), true));
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- close reads the same draft
    }, [draft.capture, draft.plantId]),
  );

  // The plant is saved: going back here must not touch its photo.
  if (draft.plantId) return <Redirect href="/add/health" />;

  return <CaptureView busy={busy} failed={failed} onCapture={(uri) => void use(uri)} onClose={close} />;
}
