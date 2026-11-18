import * as ImagePicker from 'expo-image-picker';

export type PhotoSource = 'camera' | 'library';

export const DENIED: Record<PhotoSource, string> = {
  camera: 'Camera access is off. Allow it in Settings to take photos.',
  library: 'Photo access is off. Allow it in Settings to choose photos.',
};

/** Asks for permission, opens the camera or library; `uri` is unset when cancelled, `denied` when permission is off. */
export async function pickPhoto(source: PhotoSource): Promise<{ uri?: string; denied?: boolean }> {
  const camera = source === 'camera';
  const perm = await (camera
    ? ImagePicker.requestCameraPermissionsAsync()
    : ImagePicker.requestMediaLibraryPermissionsAsync());
  if (!perm.granted) return { denied: true };
  const options = { mediaTypes: ['images' as const] };
  const res = await (camera ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options));
  return res.canceled ? {} : { uri: res.assets[0].uri };
}
