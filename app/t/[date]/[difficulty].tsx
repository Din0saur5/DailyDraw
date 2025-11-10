import { useCallback, useMemo } from 'react';

import { Stack, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import FeedList from '@/components/feed/FeedList';
import { trackEvent } from '@/lib/analytics';
import { useCreateSubmissionMutation } from '@/lib/mutations/submissions';
import { useSubmissionForPrompt, useTodayPrompts } from '@/lib/queries';
import { pickUploadAsset, uploadPreparedAsset } from '@/lib/uploads';
import { useSessionStore } from '@/stores/useSessionStore';
import { createEmptyUploadEntry, useUploadStore } from '@/stores/useUploadStore';
import { DailyPrompt, difficultyLabels, PromptDifficulty } from '@/types/prompt';
import { useQueryClient } from '@tanstack/react-query';
import { palette } from '@/constants/palette';

export default function ThreadScreen() {
  const { date, difficulty } = useLocalSearchParams<{ date?: string; difficulty?: string }>();
  const { data: prompts = [], isLoading, isError, refetch } = useTodayPrompts();
  const currentUserId = useSessionStore((state) => state.profile?.id ?? null);

  const prompt = useMemo(() => {
    if (!date || !difficulty) return null;
    return (
      prompts.find(
        (item) =>
          item.promptDate.slice(0, 10) === date &&
          item.difficulty === (difficulty as PromptDifficulty),
      ) ?? null
    );
  }, [date, difficulty, prompts]);

  const promptId = prompt?.id ?? null;
  const uploadEntry = useUploadStore((state) =>
    promptId ? state.uploads[promptId] : undefined,
  );
  const { data: serverSubmission } = useSubmissionForPrompt(promptId, currentUserId);

  const hasLocalSubmission = Boolean(
    uploadEntry && (uploadEntry.status === 'success' || uploadEntry.lastUploadedKey),
  );
  const hasServerSubmission = Boolean(serverSubmission && !serverSubmission.isRemoved);
  const canShowFeed = Boolean(prompt && (hasLocalSubmission || hasServerSubmission));

  const headerTitle = prompt
    ? `${difficultyLabels[prompt.difficulty]} · ${formatPromptDate(prompt.promptDate)}`
    : `${difficulty ?? 'Thread'} · ${date ?? ''}`;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: headerTitle, headerLargeTitle: false }} />
      <View style={styles.statusArea}>
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Fetching prompt details…</Text>
          </View>
        )}
        {isError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Unable to load prompt.</Text>
            <Pressable style={styles.refetchButton} onPress={() => refetch()}>
              <Text style={styles.refetchButtonText}>Try again</Text>
            </Pressable>
          </View>
        )}
        {!prompt && !isLoading && (
          <View style={styles.missingPrompt}>
            <Text style={styles.missingPromptTitle}>Prompt unavailable</Text>
            <Text style={styles.missingPromptBody}>
              We could not find a prompt matching this URL. Make sure you opened today&apos;s
              challenge from the home screen.
            </Text>
          </View>
        )}
      </View>
      {prompt &&
        (canShowFeed ? (
          <FeedList
            dailyPromptId={prompt.id}
            currentUserId={currentUserId}
            header={
              <View style={styles.headerStack}>
                <PromptSummary prompt={prompt} />
              </View>
            }
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.uploadContent}
            showsVerticalScrollIndicator={false}
          >
            <PromptSummary prompt={prompt} />
            <UploadPanel prompt={prompt} />
            <View style={styles.lockedCard}>
              <Text style={styles.lockedTitle}>Share to unlock today&apos;s feed</Text>
              <Text style={styles.lockedBody}>
                Upload your drawing to join the conversation for this prompt.
              </Text>
            </View>
          </ScrollView>
        ))}
    </View>
  );
}

type PromptSummaryProps = {
  prompt: DailyPrompt;
};

function PromptSummary({ prompt }: PromptSummaryProps) {
  return (
    <View style={styles.promptSummary}>
      <Text style={styles.promptDate}>{formatPromptDate(prompt.promptDate)}</Text>
      <Text style={styles.promptDifficulty}>{difficultyLabels[prompt.difficulty]}</Text>
      <Text style={styles.promptText}>{prompt.promptText}</Text>
      <Text style={styles.promptSupport}>
        Upload one original piece of art for the prompt to be able to view everyone else's submissions!
      </Text>
    </View>
  );
}

type UploadPanelProps = {
  prompt: DailyPrompt;
};

function UploadPanel({ prompt }: UploadPanelProps) {
  const queryClient = useQueryClient();
  const storeEntry = useUploadStore((state) => state.uploads[prompt.id]);
  const fallbackEntry = useMemo(() => createEmptyUploadEntry(), []);
  const entry = storeEntry ?? fallbackEntry;
  const beginSelection = useUploadStore((state) => state.beginSelection);
  const setAsset = useUploadStore((state) => state.setAsset);
  const setCaption = useUploadStore((state) => state.setCaption);
  const startUpload = useUploadStore((state) => state.startUpload);
  const markSuccess = useUploadStore((state) => state.markSuccess);
  const markError = useUploadStore((state) => state.markError);
  const currentUserId = useSessionStore((state) => state.profile?.id ?? null);

  const { mutateAsync: submitSubmission } = useCreateSubmissionMutation();
  const isBusy = entry.status === 'uploading';
  const isReadyToUpload = Boolean(entry.asset);
  const remainingChars = 300 - entry.caption.length;

  const handleSelect = useCallback(async () => {
    try {
      beginSelection(prompt.id);
      const asset = await pickUploadAsset();
      if (!asset) {
        setAsset(prompt.id, null);
        return;
      }
      setAsset(prompt.id, asset);
    } catch (error) {
      setAsset(prompt.id, null);
      Alert.alert('Unable to select image', extractMessage(error));
    }
  }, [beginSelection, prompt.id, setAsset]);

  const handleUpload = useCallback(async () => {
    if (!entry.asset) {
      markError(prompt.id, 'Select an image to continue.');
      return;
    }
    const caption = entry.caption.trim();
    if (caption.length > 300) {
      markError(prompt.id, 'Caption must be 300 characters or less.');
      return;
    }

    try {
      startUpload(prompt.id);
      const uploadResult = await uploadPreparedAsset({
        asset: entry.asset,
        promptDate: prompt.promptDate.slice(0, 10),
      });

      const submission = await submitSubmission({
        dailyPromptId: prompt.id,
        key: uploadResult.key,
        caption: caption.length ? caption : null,
        width: entry.asset.width,
        height: entry.asset.height,
        mime: uploadResult.mime,
      });

      const hasPrevious = Boolean(useUploadStore.getState().uploads[prompt.id]?.lastUploadedKey);
      markSuccess(prompt.id, submission.originalKey, hasPrevious);
      await queryClient.invalidateQueries({ queryKey: ['feed', prompt.id] });
      if (currentUserId) {
        await queryClient.invalidateQueries({
          queryKey: ['submission', currentUserId, prompt.id],
        });
      }
      trackEvent('upload_success', { promptId: prompt.id, replaced: hasPrevious });
    } catch (error) {
      const message = extractMessage(error);
      markError(prompt.id, message);
      trackEvent('upload_failed', { promptId: prompt.id, message });
    }
  }, [
    currentUserId,
    entry.asset,
    entry.caption,
    markError,
    markSuccess,
    prompt.id,
    prompt.promptDate,
    queryClient,
    startUpload,
    submitSubmission,
  ]);

  return (
    <View style={styles.uploadPanel}>
      <View style={styles.uploadHeader}>
        <Text style={styles.uploadTitle}>Upload your drawing</Text>
        {entry.retries > 0 && <Text style={styles.retryCount}>Attempts: {entry.retries}</Text>}
      </View>
      <Text style={styles.uploadHint}>
        We accept JPEG or PNG up to 10MB. Resize happens automatically before upload.
      </Text>
      <Pressable
        style={[styles.selectButton, isBusy && styles.disabledButton]}
        onPress={handleSelect}
        disabled={isBusy}
      >
        <Text style={styles.selectButtonText}>
          {entry.asset ? 'Pick another image' : 'Select image'}
        </Text>
      </Pressable>
      {entry.asset && (
        <View style={styles.previewCard}>
          <Image source={{ uri: entry.asset.uri }} style={styles.previewImage} />
          <View style={styles.previewMeta}>
            <Text style={styles.previewMetaText}>
              {entry.asset.width} × {entry.asset.height}
            </Text>
            <Text style={styles.previewMetaText}>{formatFileSize(entry.asset.size)}</Text>
            <Text style={styles.previewMetaText}>{entry.asset.mime}</Text>
          </View>
        </View>
      )}

      <View style={styles.captionField}>
        <Text style={styles.captionLabel}>Caption (optional)</Text>
        <TextInput
          value={entry.caption}
          onChangeText={(value) => setCaption(prompt.id, value)}
          placeholder="Tell the community about your piece"
          placeholderTextColor="#9ca3af"
          style={styles.captionInput}
          maxLength={300}
          multiline
          editable={!isBusy}
        />
        <Text style={styles.captionCounter}>{remainingChars} characters left</Text>
      </View>

      {entry.error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>{entry.error}</Text>
        </View>
      )}

      {entry.status === 'success' && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>
            {entry.wasReplacement
              ? 'Replaced your previous upload for this prompt.'
              : 'Upload received! It will appear after moderation.'}
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.uploadButton, (!isReadyToUpload || isBusy) && styles.disabledButton]}
        onPress={handleUpload}
        disabled={!isReadyToUpload || isBusy}
      >
        {isBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.uploadButtonText}>Upload drawing</Text>
        )}
      </Pressable>
    </View>
  );
}

const formatPromptDate = (isoDate: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDate));

const formatFileSize = (bytes: number) => {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(2)} MB`;
};

const extractMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  uploadContent: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
    backgroundColor: palette.canvas,
  },
  statusArea: {
    padding: 24,
    gap: 16,
    backgroundColor: palette.canvas,
  },
  headerStack: {
    gap: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    color: '#374151',
  },
  errorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 12,
    gap: 8,
  },
  errorTitle: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  refetchButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  refetchButtonText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  missingPrompt: {
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginTop: 16,
    backgroundColor: '#fffef8',
  },
  missingPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  missingPromptBody: {
    color: '#4b5563',
  },
  promptSummary: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.gray,
    padding: 16,
    gap: 8,
    backgroundColor: '#fffef8',
  },
  promptDate: {
    color: '#6b7280',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  promptDifficulty: {
    fontSize: 14,
    fontWeight: '600',
  },
  promptText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  promptSupport: {
    color: '#4b5563',
    lineHeight: 20,
  },
  uploadPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.gray,
    padding: 16,
    gap: 12,
    backgroundColor: '#fffef8',
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  retryCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  uploadHint: {
    color: '#4b5563',
  },
  selectButton: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: palette.gray,
    alignItems: 'center',
  },
  selectButtonText: {
    fontWeight: '600',
    color: palette.black,
  },
  previewCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  previewMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  previewMetaText: {
    color: '#4b5563',
    fontSize: 12,
  },
  captionField: {
    gap: 6,
  },
  captionLabel: {
    fontWeight: '600',
    color: '#111827',
  },
  captionInput: {
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    color: palette.black,
    backgroundColor: '#fffef8',
  },
  captionCounter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: '#6b7280',
  },
  successBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ecfdf5',
    padding: 12,
  },
  successText: {
    color: '#166534',
    fontWeight: '600',
  },
  uploadButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: palette.black,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  lockedCard: {
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: '#fffef8',
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  lockedBody: {
    color: '#4b5563',
    lineHeight: 20,
  },
});
