import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject as firebaseDeleteObject,
  getMetadata,
  updateMetadata,
  UploadTask,
  StorageError,
} from 'firebase/storage';
import { storage } from './config';

const MODELS_PATH = 'models';
const IMAGES_PATH = 'images';
const THUMBNAILS_PATH = 'thumbnails';

interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

interface UploadResult {
  url: string;
  fullPath: string;
  name: string;
}

export const uploadModel = async (
  file: File,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const sanitizedFileName = sanitizeFileName(file.name);
  const timestamp = Date.now();
  const path = `${MODELS_PATH}/${userId}/${timestamp}_${sanitizedFileName}`;
  const storageRef = ref(storage, path);

  try {
    validateModelFile(file);
    const metadata = buildMetadata(file, userId, 'model');

    const result = await uploadFile(storageRef, file, metadata, onProgress);
    return {
      url: result.url,
      fullPath: result.fullPath,
      name: sanitizedFileName,
    };
  } catch (error) {
    console.error('Model upload failed:', error);
    throw new Error(getStorageErrorMessage(error));
  }
};

export const getModelUrl = async (modelPath: string): Promise<string> => {
  try {
    const storageRef = ref(storage, modelPath);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error('Failed to get model URL:', error);
    throw new Error(getStorageErrorMessage(error));
  }
};

export const deleteModel = async (modelPath: string): Promise<void> => {
  try {
    const storageRef = ref(storage, modelPath);
    await firebaseDeleteObject(storageRef);
  } catch (error) {
    console.error('Failed to delete model:', error);
    throw new Error(getStorageErrorMessage(error));
  }
};

export const uploadImage = async (
  file: File,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const sanitizedFileName = sanitizeFileName(file.name);
  const timestamp = Date.now();
  const path = `${IMAGES_PATH}/${userId}/${timestamp}_${sanitizedFileName}`;
  const storageRef = ref(storage, path);

  try {
    validateImageFile(file);
    const metadata = buildMetadata(file, userId, 'image');

    const result = await uploadFile(storageRef, file, metadata, onProgress);
    return {
      url: result.url,
      fullPath: result.fullPath,
      name: sanitizedFileName,
    };
  } catch (error) {
    console.error('Image upload failed:', error);
    throw new Error(getStorageErrorMessage(error));
  }
};

export const getImageUrl = async (imagePath: string): Promise<string> => {
  try {
    const storageRef = ref(storage, imagePath);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error('Failed to get image URL:', error);
    throw new Error(getStorageErrorMessage(error));
  }
};

export const uploadThumbnail = async (
  file: File,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const sanitizedFileName = sanitizeFileName(file.name);
  const timestamp = Date.now();
  const path = `${THUMBNAILS_PATH}/${userId}/${timestamp}_${sanitizedFileName}`;
  const storageRef = ref(storage, path);

  try {
    validateImageFile(file);
    const metadata = buildMetadata(file, userId, 'thumbnail');

    const result = await uploadFile(storageRef, file, metadata, onProgress);
    return {
      url: result.url,
      fullPath: result.fullPath,
      name: sanitizedFileName,
    };
  } catch (error) {
    console.error('Thumbnail upload failed:', error);
    throw new Error(getStorageErrorMessage(error));
  }
};

export const getFileMetadata = async (filePath: string) => {
  try {
    const storageRef = ref(storage, filePath);
    const metadata = await getMetadata(storageRef);
    return metadata;
  } catch (error) {
    console.error('Failed to get file metadata:', error);
    throw new Error(getStorageErrorMessage(error));
  }
};

export const updateFileMetadata = async (
  filePath: string,
  metadata: Record<string, string>
): Promise<void> => {
  try {
    const storageRef = ref(storage, filePath);
    await updateMetadata(storageRef, { customMetadata: metadata });
  } catch (error) {
    console.error('Failed to update file metadata:', error);
    throw new Error(getStorageErrorMessage(error));
  }
};

const uploadFile = (
  storageRef: ReturnType<typeof ref>,
  file: File,
  metadata: Record<string, string>,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadTask: UploadTask = uploadBytesResumable(
      storageRef,
      file,
      metadata
    );

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress: UploadProgress = {
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          percentage: Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          ),
        };
        onProgress?.(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            url,
            fullPath: uploadTask.snapshot.ref.fullPath,
            name: file.name,
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};

const sanitizeFileName = (fileName: string): string => {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

const validateModelFile = (file: File): void => {
  const allowedTypes = [
    'model/gltf-binary',
    'model/gltf+json',
    'application/octet-stream',
    '.glb',
    '.gltf',
    '.obj',
  ];

  const maxSize = 50 * 1024 * 1024; // 50MB

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['glb', 'gltf', 'obj'].includes(ext || '')) {
    throw new Error('Invalid model format. Supported: GLB, GLTF, OBJ');
  }

  if (file.size > maxSize) {
    throw new Error('Model file too large. Maximum size: 50MB');
  }
};

const validateImageFile = (file: File): void => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid image format. Supported: JPEG, PNG, WebP, GIF');
  }

  if (file.size > maxSize) {
    throw new Error('Image file too large. Maximum size: 10MB');
  }
};

const buildMetadata = (
  file: File,
  userId: string,
  type: string
): Record<string, string> => ({
  uploadedBy: userId,
  uploadedAt: new Date().toISOString(),
  type,
  originalName: file.name,
  contentType: file.type,
});

const getStorageErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const storageError = error as StorageError;
    switch (storageError.code) {
      case 'storage/unauthorized':
        return 'You do not have permission to upload files';
      case 'storage/canceled':
        return 'Upload was canceled';
      case 'storage/unknown':
        return 'An unknown error occurred during upload';
      case 'storage/object-not-found':
        return 'File not found';
      case 'storage/quota-exceeded':
        return 'Storage quota exceeded';
      case 'storage/invalid-format':
        return 'Invalid file format';
      case 'storage/server-file-wrong-size':
        return 'File size mismatch';
      default:
        return storageError.message || 'Storage operation failed';
    }
  }
  return 'An unexpected error occurred';
};
