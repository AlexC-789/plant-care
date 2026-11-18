import { Easing } from 'react-native';

/** Shared motion values for the add-a-plant steps (ms). No bounce, never scale from 0. */
export const motion = {
  easeOut: Easing.bezier(0.23, 1, 0.32, 1),
  duration: { success: 200, progress: 250 },
  stagger: 60,
};
