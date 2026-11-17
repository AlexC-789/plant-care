import { router } from 'expo-router';

import { Button } from '@/ui';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** "Done" for a sheet's navigation bar: returns to the screen underneath. */
export function CloseButton() {
  return <Button label="Done" variant="plain" onPress={close} />;
}
