import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { invokeEdge } from '@/lib/edge';

const MAX_DIMENSION = 2048;
const MAX_BYTES = 10 * 1024 * 1024;
const SIGNED_UPLOAD_RETRIES = 2;
const UPLOAD_TIMEOUT_MS = 60 * 1000;

export type PreparedUpload = {
  uri: string;
  width: number;
  height: number;
  size: number;
  mime: string;
  ext: 'jpg' | 'png';
};

type UploadSignatureResponse = {
  key: string;
  mime: string;
  putUrl: string;
  expiresAt: string;
};

export async function pickUploadAsset(): Promise<PreparedUpload | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Media library permission is required to select photos.');
  }

  const selection = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'] as ImagePicker.MediaType[],
    allowsMultipleSelection: false,
    allowsEditing: false,
    exif: false,
    quality: 1,
  });

  if (selection.canceled || !selection.assets?.length) {
    return null;
  }

  const asset = selection.assets[0];
  if (!asset.uri || !asset.width || !asset.height) {
    throw new Error('Unable to read the selected image metadata.');
  }

  const format = inferFormat(asset);
  const resize = scaleDimensions(asset.width, asset.height);
  const manipResult = await ImageManipulator.manipulateAsync(
    asset.uri,
    resize.shouldResize ? [{ resize: { width: resize.width, height: resize.height } }] : [],
    {
      compress: format === 'png' ? 1 : 0.92,
      format: format === 'png' ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
      base64: false,
    },
  );

  const info = await FileSystem.getInfoAsync(manipResult.uri);
  if (!info.exists || typeof info.size !== 'number') {
    throw new Error('Unable to determine processed image size.');
  }

  if (info.size > MAX_BYTES) {
    throw new Error('Processed image exceeds the 10MB upload limit.');
  }

  return {
    uri: manipResult.uri,
    width: manipResult.width ?? resize.width,
    height: manipResult.height ?? resize.height,
    size: info.size,
    mime: format === 'png' ? 'image/png' : 'image/jpeg',
    ext: format,
  };
}

export async function uploadPreparedAsset(params: {
  asset: PreparedUpload;
  promptDate: string;
}): Promise<{ key: string; mime: string }> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < SIGNED_UPLOAD_RETRIES) {
    attempt += 1;
    const signature = await invokeEdge<UploadSignatureResponse>('uploads-sign', {
      body: {
        ext: params.asset.ext,
        size: params.asset.size,
        promptDate: params.promptDate,
      },
    });

    const uploadResult = await runWithTimeout(
      () =>
        FileSystem.uploadAsync(signature.putUrl, params.asset.uri, {
          httpMethod: 'PUT',
          headers: {
            'Content-Type': signature.mime,
          },
        }),
      UPLOAD_TIMEOUT_MS,
      'Upload is taking longer than expected. Check your connection and try again.',
    );

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      return { key: signature.key, mime: signature.mime };
    }

    const serverMessage = describeUploadFailure(uploadResult.status, uploadResult.body);

    if (uploadResult.status === 403) {
      lastError = new Error(serverMessage ?? 'Upload URL expired. Retrying with a new signature.');
      continue;
    }

    throw new Error(serverMessage ?? `Upload failed with status ${uploadResult.status}`);
  }

  throw lastError ?? new Error('Upload failed after multiple attempts.');
}

const inferFormat = (asset: ImagePicker.ImagePickerAsset): 'jpg' | 'png' => {
  const name = asset.fileName?.toLowerCase() ?? '';
  if (name.endsWith('.png') || asset.mimeType === 'image/png') {
    return 'png';
  }
  return 'jpg';
};

const scaleDimensions = (width: number, height: number) => {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return { width, height, shouldResize: false };
  }

  const longestSide = Math.max(width, height);
  const scale = MAX_DIMENSION / longestSide;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    shouldResize: true,
  };
};

const describeUploadFailure = (status: number, body?: string | null) => {
  if (!body) return null;
  const trimmed = body.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.message === 'string') {
      return parsed.message;
    }
    if (typeof parsed?.error === 'string') {
      return parsed.error;
    }
    if (typeof parsed?.Error === 'string') {
      return parsed.Error;
    }
  } catch {
    // ignore JSON parse errors – fall back to raw body text
  }

  if (status === 403 && /expired/i.test(trimmed)) {
    return 'Upload URL expired. Retrying with a new signature.';
  }

  return trimmed;
};

const runWithTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};
