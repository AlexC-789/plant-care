import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';

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

  async function use(uri: string) {
    if (!userId || working.current) return;
    working.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const prepared = await preparePhoto(uri);
      const path = await uploadPhoto(userId, prepared);
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
    if (draft.capture) void deletePhotos([draft.capture.path]).catch(() => {});
    router.back();
  };

  // The plant is saved: going back here must not touch its photo.
  if (draft.plantId) return <Redirect href="/add/health" />;

  return <CaptureView busy={busy} failed={failed} onCapture={(uri) => void use(uri)} onClose={close} />;
}
