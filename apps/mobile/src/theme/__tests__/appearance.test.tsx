import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import * as RN from 'react-native';

import {
  colors,
  loadStoredAppearance,
  resetAppearanceForTests,
  useAppearance,
  useAppearanceLoaded,
  useTheme,
} from '@/theme';

const KEY = 'plant-care.appearance';

beforeEach(async () => {
  resetAppearanceForTests();
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

test('light by default, even when the phone is in dark mode', async () => {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
  const { result } = await renderHook(() => useTheme());
  expect(result.current.scheme).toBe('light');
  expect(result.current.colors).toBe(colors.light);
});

test('choosing Dark switches the theme, saves it and tells the platform', async () => {
  const setColorScheme = jest.spyOn(RN.Appearance, 'setColorScheme').mockImplementation(() => {});
  const { result } = await renderHook(() => ({ a: useAppearance(), t: useTheme() }));
  await act(async () => result.current.a.setAppearance('dark'));
  expect(result.current.a.appearance).toBe('dark');
  expect(result.current.t.colors).toBe(colors.dark);
  expect(setColorScheme).toHaveBeenCalledWith('dark');
  expect(await AsyncStorage.getItem(KEY)).toBe('dark');
});

test('a saved choice is applied on start, and loading is reported', async () => {
  await AsyncStorage.setItem(KEY, 'dark');
  const { result } = await renderHook(() => ({ loaded: useAppearanceLoaded(), t: useTheme() }));
  expect(result.current.loaded).toBe(false);
  await act(async () => loadStoredAppearance());
  expect(result.current.loaded).toBe(true);
  expect(result.current.t.scheme).toBe('dark');
});

test('an unknown stored value falls back to light', async () => {
  await AsyncStorage.setItem(KEY, 'purple');
  await act(async () => loadStoredAppearance());
  const { result } = await renderHook(() => useTheme());
  expect(result.current.scheme).toBe('light');
});

test('a storage failure on save still switches for this session', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('disk full'));
  const { result } = await renderHook(() => ({ a: useAppearance(), t: useTheme() }));
  await act(async () => result.current.a.setAppearance('dark'));
  expect(result.current.t.scheme).toBe('dark');
});

test('a storage failure on load still finishes loading (light)', async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('broken'));
  await act(async () => loadStoredAppearance());
  const { result } = await renderHook(() => ({ loaded: useAppearanceLoaded(), t: useTheme() }));
  expect(result.current.loaded).toBe(true);
  expect(result.current.t.scheme).toBe('light');
});
