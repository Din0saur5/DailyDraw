import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ListRenderItemInfo,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SubmissionWithUser } from '@/types/submission';
import { useFeedQuery } from '@/lib/queries/feed';
import { useSignedImageUrl } from '@/lib/queries/images';
import { useReportSubmissionMutation } from '@/lib/mutations/reports';
import { trackEvent } from '@/lib/analytics';

type FeedListProps = {
  dailyPromptId: string;
  currentUserId?: string | null;
  header?: ReactNode;
};

const REPORT_REASONS = [
  'Inappropriate or NSFW',
  'Spam or advertising',
  'Plagiarism or AI-generated art',
  'Harassment or hate',
];

export default function FeedList({ dailyPromptId, currentUserId, header }: FeedListProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeedQuery(dailyPromptId);

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<SubmissionWithUser | null>(null);

  useEffect(() => {
    setHiddenIds(new Set());
    setReportTarget(null);
  }, [dailyPromptId]);

  const pages = (data?.pages ?? []) as SubmissionWithUser[][];
  const allItems = useMemo(() => (pages.length ? pages.flat() : []), [pages]);

  const visibleItems = useMemo(() => {
    if (!hiddenIds.size) return allItems;
    return allItems.filter((item) => !hiddenIds.has(item.id));
  }, [allItems, hiddenIds]);

  const hideItem = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const restoreItem = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const highlightOwnFirst = Boolean(visibleItems[0] && visibleItems[0].userId === currentUserId);

  const reportMutation = useReportSubmissionMutation();

  const handleRefresh = useCallback(() => {
    trackEvent('feed_refresh', { promptId: dailyPromptId });
    return refetch();
  }, [dailyPromptId, refetch]);

  const handleEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleConfirmReport = useCallback(
    async (reason: string) => {
      if (!reportTarget) return;
      hideItem(reportTarget.id);
      try {
        await reportMutation.mutateAsync({ submissionId: reportTarget.id, reason });
        trackEvent('feed_report_submitted', {
          promptId: dailyPromptId,
          submissionId: reportTarget.id,
        });
        await refetch();
      } catch (err) {
        restoreItem(reportTarget.id);
        Alert.alert('Unable to submit report', extractMessage(err));
      } finally {
        setReportTarget(null);
      }
    },
    [dailyPromptId, hideItem, refetch, reportMutation, reportTarget, restoreItem],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<SubmissionWithUser>) => (
      <FeedCard
        item={item}
        onReport={() => setReportTarget(item)}
        showOwnBadge={highlightOwnFirst && index === 0}
      />
    ),
    [highlightOwnFirst],
  );

  return (
    <View style={styles.listContainer}>
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.itemSpacer} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            colors={['#111827']}
            tintColor="#111827"
          />
        }
        ListHeaderComponent={
          <View style={styles.headerStack}>
            {header}
            <View style={styles.feedHeaderRow}>
              <Text style={styles.feedHeaderTitle}>Community feed</Text>
              {highlightOwnFirst && (
                <View style={styles.feedHeaderBadge}>
                  <Text style={styles.feedHeaderBadgeText}>Your upload is leading the feed 🎉</Text>
                </View>
              )}
            </View>
            {isError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorTitle}>Unable to load submissions.</Text>
                <Text style={styles.errorBody}>{extractMessage(error)}</Text>
                <Pressable style={styles.retryButton} onPress={() => refetch()}>
                  <Text style={styles.retryButtonText}>Try again</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          <ListFooter
            isFetching={isFetchingNextPage}
            hasMore={!!hasNextPage}
            hasItems={visibleItems.length > 0}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <FeedPlaceholderList />
          ) : (
            <EmptyFeedState
              onRetry={() => {
                refetch();
              }}
            />
          )
        }
      />

      <ReportSheet
        visible={Boolean(reportTarget)}
        username={reportTarget?.user.username}
        onCancel={() => setReportTarget(null)}
        onSubmit={handleConfirmReport}
        isSubmitting={reportMutation.isPending}
      />
    </View>
  );
}

type FeedCardProps = {
  item: SubmissionWithUser;
  onReport: () => void;
  showOwnBadge: boolean;
};

function FeedCard({ item, onReport, showOwnBadge }: FeedCardProps) {
  const { data, isLoading, isError, refetch } = useSignedImageUrl(item.originalKey);
  const postedAt = useMemo(() => formatRelativeTime(item.createdAt), [item.createdAt]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardUsername}>@{item.user.username}</Text>
          <Text style={styles.cardMeta}>{postedAt}</Text>
        </View>
        <Pressable style={styles.reportButton} onPress={onReport}>
          <Text style={styles.reportButtonText}>Report</Text>
        </Pressable>
      </View>

      {showOwnBadge && (
        <View style={styles.ownBadge}>
          <Text style={styles.ownBadgeText}>This is your submission</Text>
        </View>
      )}

      <View style={styles.cardImageShell}>
        {isLoading && (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator color="#4b5563" />
            <Text style={styles.imagePlaceholderText}>Loading art…</Text>
          </View>
        )}
        {isError && (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>Unable to load image.</Text>
            <Pressable onPress={() => refetch()}>
              <Text style={styles.retryMiniButton}>Retry</Text>
            </Pressable>
          </View>
        )}
        {!isLoading && !isError && data?.url && (
          <Image source={{ uri: data.url }} style={styles.cardImage} resizeMode="cover" />
        )}
      </View>

      {item.caption && <Text style={styles.cardCaption}>{item.caption}</Text>}
    </View>
  );
}

type ListFooterProps = {
  isFetching: boolean;
  hasMore: boolean;
  hasItems: boolean;
};

function ListFooter({ isFetching, hasMore, hasItems }: ListFooterProps) {
  if (isFetching) {
    return (
      <View style={styles.footer}>
        <ActivityIndicator />
        <Text style={styles.footerText}>Loading more submissions…</Text>
      </View>
    );
  }
  if (!hasMore && hasItems) {
    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>You reached the end of today&apos;s feed.</Text>
      </View>
    );
  }
  return null;
}

type EmptyFeedStateProps = {
  onRetry: () => void;
};

function EmptyFeedState({ onRetry }: EmptyFeedStateProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No submissions yet</Text>
      <Text style={styles.emptyBody}>
        Be the first to upload for today&apos;s prompt. Your drawing will appear here after moderation.
      </Text>
      <Pressable style={styles.retryButton} onPress={() => onRetry()}>
        <Text style={styles.retryButtonText}>Refresh feed</Text>
      </Pressable>
    </View>
  );
}

function FeedPlaceholderList() {
  return (
    <View style={styles.placeholderStack}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.placeholderCard}>
          <View style={styles.placeholderLineShort} />
          <View style={styles.placeholderLineLong} />
          <View style={styles.placeholderImage} />
        </View>
      ))}
    </View>
  );
}

type ReportSheetProps = {
  visible: boolean;
  username?: string;
  onCancel: () => void;
  onSubmit: (reason: string) => void | Promise<void>;
  isSubmitting: boolean;
};

function ReportSheet({ visible, username, onCancel, onSubmit, isSubmitting }: ReportSheetProps) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);

  useEffect(() => {
    if (visible) {
      setReason(REPORT_REASONS[0]);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.sheetContainer}>
        <Pressable style={styles.sheetBackdrop} onPress={onCancel} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Report submission</Text>
          {username && <Text style={styles.sheetSubtitle}>@{username}</Text>}
          <Text style={styles.sheetHint}>Select a reason so our moderators can take a look.</Text>
          <View style={styles.sheetOptions}>
            {REPORT_REASONS.map((option) => (
              <Pressable
                key={option}
                style={[styles.sheetOption, reason === option && styles.sheetOptionActive]}
                onPress={() => setReason(option)}
              >
                <View style={[styles.radioOuter, reason === option && styles.radioOuterActive]}>
                  {reason === option && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.sheetOptionText}>{option}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.sheetActions}>
            <Pressable style={[styles.sheetButton, styles.sheetCancel]} onPress={onCancel}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sheetButton, styles.sheetSubmit, isSubmitting && styles.disabledButton]}
              onPress={() => onSubmit(reason)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sheetSubmitText}>Submit report</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const extractMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

const formatRelativeTime = (isoDate: string) => {
  const target = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - target.getTime();
  if (Number.isNaN(diffMs)) return '';

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(target);
};

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 24,
    paddingBottom: 40,
  },
  headerStack: {
    gap: 16,
    marginBottom: 16,
  },
  feedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  feedHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  feedHeaderBadge: {
    backgroundColor: '#ecfdf5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  feedHeaderBadgeText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 12,
    gap: 6,
  },
  errorTitle: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  errorBody: {
    color: '#7f1d1d',
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  retryButtonText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  itemSpacer: {
    height: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardMeta: {
    color: '#6b7280',
    fontSize: 12,
  },
  reportButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  reportButtonText: {
    fontWeight: '600',
    color: '#111827',
  },
  ownBadge: {
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ownBadgeText: {
    color: '#0c4a6e',
    fontWeight: '600',
    fontSize: 12,
  },
  cardImageShell: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardImage: {
    width: '100%',
    height: 280,
  },
  imagePlaceholder: {
    width: '100%',
    height: 280,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    color: '#6b7280',
  },
  retryMiniButton: {
    color: '#2563eb',
    fontWeight: '600',
  },
  cardCaption: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: '#6b7280',
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  emptyBody: {
    color: '#4b5563',
    lineHeight: 20,
  },
  placeholderStack: {
    gap: 12,
  },
  placeholderCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    backgroundColor: '#fff',
    gap: 10,
  },
  placeholderLineShort: {
    height: 12,
    width: '40%',
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  placeholderLineLong: {
    height: 12,
    width: '70%',
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  placeholderImage: {
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sheetSubtitle: {
    color: '#4b5563',
  },
  sheetHint: {
    color: '#6b7280',
  },
  sheetOptions: {
    gap: 8,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sheetOptionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  sheetOptionText: {
    color: '#111827',
    fontWeight: '500',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  sheetCancel: {
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  sheetCancelText: {
    color: '#111827',
    fontWeight: '600',
  },
  sheetSubmit: {
    backgroundColor: '#111827',
  },
  sheetSubmitText: {
    color: '#fff',
    fontWeight: '600',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#2563eb',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
