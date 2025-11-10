import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { PreparedUpload } from '@/lib/uploads';

export type UploadStatus = 'idle' | 'selecting' | 'ready' | 'uploading' | 'success' | 'error';

export type UploadEntry = {
  status: UploadStatus;
  asset: PreparedUpload | null;
  caption: string;
  retries: number;
  error: string | null;
  lastUploadedKey: string | null;
  completedAt: string | null;
  wasReplacement: boolean;
};

type UploadStoreState = {
  uploads: Record<string, UploadEntry>;
  beginSelection: (promptId: string) => void;
  setCaption: (promptId: string, caption: string) => void;
  setAsset: (promptId: string, asset: PreparedUpload | null) => void;
  startUpload: (promptId: string) => void;
  markSuccess: (promptId: string, key: string, isReplacement: boolean) => void;
  markError: (promptId: string, message: string) => void;
  reset: (promptId: string) => void;
};

const defaultEntry = (): UploadEntry => ({
  status: 'idle',
  asset: null,
  caption: '',
  retries: 0,
  error: null,
  lastUploadedKey: null,
  completedAt: null,
  wasReplacement: false,
});

export const useUploadStore = create<UploadStoreState>()(
  persist(
    (set) => ({
      uploads: {},
      beginSelection(promptId) {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [promptId]: {
              ...ensureEntry(state.uploads[promptId]),
              status: 'selecting',
              error: null,
            },
          },
        }));
      },
      setCaption(promptId, caption) {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [promptId]: {
              ...ensureEntry(state.uploads[promptId]),
              caption,
            },
          },
        }));
      },
      setAsset(promptId, asset) {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [promptId]: {
              ...ensureEntry(state.uploads[promptId]),
              asset,
              status: asset ? 'ready' : 'idle',
              error: null,
            },
          },
        }));
      },
      startUpload(promptId) {
        set((state) => {
          const current = ensureEntry(state.uploads[promptId]);
          return {
            uploads: {
              ...state.uploads,
              [promptId]: {
                ...current,
                status: 'uploading',
                retries: current.retries + 1,
                error: null,
                wasReplacement: false,
              },
            },
          };
        });
      },
      markSuccess(promptId, key, isReplacement) {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [promptId]: {
              ...ensureEntry(state.uploads[promptId]),
              status: 'success',
              error: null,
              lastUploadedKey: key,
              completedAt: new Date().toISOString(),
              wasReplacement: isReplacement,
            },
          },
        }));
      },
      markError(promptId, message) {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [promptId]: {
              ...ensureEntry(state.uploads[promptId]),
              status: 'error',
              error: message,
            },
          },
        }));
      },
      reset(promptId) {
        set((state) => {
          const updated = { ...state.uploads };
          updated[promptId] = defaultEntry();
          return { uploads: updated };
        });
      },
    }),
    {
      name: 'uploads-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        uploads: state.uploads,
      }),
    },
  ),
);

const ensureEntry = (entry?: UploadEntry): UploadEntry => entry ?? defaultEntry();

export const createEmptyUploadEntry = () => defaultEntry();
