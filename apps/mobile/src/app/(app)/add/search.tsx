import { useRouter } from 'expo-router';

import { useAddDraft } from '@/plants/addDraft';
import { TypeSearch } from '@/plants/TypeSearch';

export default function Search() {
  const router = useRouter();
  const { set } = useAddDraft();
  return (
    <TypeSearch
      onPick={(species) => {
        set({ species });
        router.back();
      }}
    />
  );
}
