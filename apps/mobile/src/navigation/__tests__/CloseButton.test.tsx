import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { CloseButton } from '@/navigation/CloseButton';

test('Done goes back to the screen underneath', async () => {
  const view = await renderRouter(
    {
      index: () => <Text>Plants</Text>,
      settings: () => <CloseButton />,
    },
    { initialUrl: '/settings' },
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(view.getPathname()).toBe('/'));
});
