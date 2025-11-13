import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ListRenderItemInfo,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { palette } from '@/constants/palette';
import {
  endIapConnection,
  initIapConnection,
  loadPremiumProductDetails,
  purchasePremium,
  type PremiumProductDetails,
} from '@/lib/iap';
import { env } from '@/lib/env';
import { usePremiumStatusMutation } from '@/lib/mutations/premium';
import { fetchUserProfile } from '@/lib/profile';
import { useLibraryQuery, useSignedImageUrl } from '@/lib/queries';
import { useSessionStore } from '@/stores/useSessionStore';
import { LibraryEntry, formatPromptLabel } from '@/types/library';

export default function LibraryScreen() {
  const profile = useSessionStore((state) => state.profile);
  const setProfile = useSessionStore((state) => state.setProfile);

  useEffect(() => {
    initIapConnection();
    return () => {
      endIapConnection();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return undefined;

      let isActive = true;

      const refreshProfile = async () => {
        const latest = await fetchUserProfile(profile.id);
        if (latest && isActive) {
          setProfile(latest);
        }
      };

      refreshProfile();
      return () => {
        isActive = false;
      };
    }, [profile?.id, setProfile]),
  );

  if (!profile) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator />
        <Text style={styles.loadingCopy}>Loading your profile…</Text>
      </View>
    );
  }

  return profile.isPremium ? <PremiumLibrary userId={profile.id} /> : <PremiumUpsell />;
}

function PremiumLibrary({ userId }: { userId: string }) {
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
  } = useLibraryQuery(userId);

  const [query, setQuery] = useState('');
  const searchTerm = query.trim().toLowerCase();

  const entries = useMemo(() => data?.pages?.flat?.() ?? [], [data?.pages]);
  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries;
    return entries.filter((entry) => {
      const promptMatch = entry.prompt?.promptText?.toLowerCase()?.includes(searchTerm);
      const dateMatch = formatPromptLabel(entry).toLowerCase().includes(searchTerm);
      const captionMatch = entry.caption?.toLowerCase()?.includes(searchTerm);
      return Boolean(promptMatch || dateMatch || captionMatch);
    });
  }, [entries, searchTerm]);

  const handleRefresh = useCallback(() => {
    return refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<LibraryEntry>) => <LibraryCard entry={item} />,
    [],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Your library</Text>
      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
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
          <View style={styles.listHeader}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search uploads by prompt or date"
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
            />
            {isError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorTitle}>Unable to load library.</Text>
                <Text style={styles.errorBody}>{extractMessage(error)}</Text>
                <Pressable style={styles.retryButton} onPress={() => refetch()}>
                  <Text style={styles.retryButtonText}>Try again</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator />
              <Text style={styles.footerText}>Loading more uploads…</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centeredContainer}>
              <ActivityIndicator />
              <Text style={styles.loadingCopy}>Gathering your uploads…</Text>
            </View>
          ) : (
            <EmptyLibraryState onRefresh={handleRefresh} />
          )
        }
      />
    </View>
  );
}

function LibraryCard({ entry }: { entry: LibraryEntry }) {
  const { data, isLoading, isError, refetch } = useSignedImageUrl(entry.originalKey);

  return (
    <View style={styles.libraryCard}>
      <View style={styles.libraryHeader}>
        <Text style={styles.libraryPrompt}>{formatPromptLabel(entry)}</Text>
        {entry.isRemoved && <Text style={styles.libraryRemoved}>Removed</Text>}
      </View>
      <Text style={styles.libraryPromptText}>
        {entry.prompt?.promptText ?? 'Prompt unavailable'}
      </Text>
      <Text style={styles.libraryTimestamp}>
        Uploaded {formatRelativeDate(entry.createdAt)}
      </Text>
      <View style={styles.libraryImageShell}>
        {isLoading && (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator />
            <Text style={styles.placeholderCopy}>Loading art…</Text>
          </View>
        )}
        {isError && (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderCopy}>Unable to load image.</Text>
            <Pressable onPress={() => refetch()}>
              <Text style={styles.retryMiniButton}>Retry</Text>
            </Pressable>
          </View>
        )}
        {!isLoading && !isError && data?.url && (
          <Image source={{ uri: data.url }} style={styles.libraryImage} resizeMode="cover" />
        )}
      </View>
      {entry.caption && <Text style={styles.libraryCaption}>{entry.caption}</Text>}
    </View>
  );
}

function PremiumUpsell() {
  const [iapBusy, setIapBusy] = useState(false);
  const [productDetails, setProductDetails] = useState<PremiumProductDetails | null>(null);
  const premiumMutation = usePremiumStatusMutation();
  const busy = iapBusy || premiumMutation.isPending;
  const upgradeLabel = productDetails?.displayPrice
    ? `Go Premium – ${productDetails.displayPrice}`
    : 'Go Premium';

  useEffect(() => {
    let isMounted = true;
    loadPremiumProductDetails()
      .then((details) => {
        if (isMounted) {
          setProductDetails(details);
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpgrade = useCallback(async () => {
    try {
      setIapBusy(true);
      console.log('[iap] env product id', env.iapProductId);
      console.log('[iap] platform', Platform.OS);
      console.log('[iap] native iap ready', Platform.OS === 'ios' && Boolean(env.iapProductId));
      const purchase = await purchasePremium();
      console.log('[iap] purchase result', purchase);
      if (!purchase.receiptData) {
        throw new Error('Apple did not return a receipt for this purchase. Please try again.');
      }
      await premiumMutation.mutateAsync({
        isPremium: true,
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        receiptData: purchase.receiptData,
      });
      Alert.alert('Welcome to Premium', 'Your upload history is now unlocked.');
    } catch (error) {
      Alert.alert('Upgrade failed', extractMessage(error));
    } finally {
      setIapBusy(false);
    }
  }, [premiumMutation]);

  // const handleRestore = useCallback(async () => {
  //   try {
  //     setIapBusy(true);
  //     const purchase = await restorePremium();
  //     if (!purchase) {
  //       Alert.alert('No purchases found', 'Use the same Apple ID used during checkout.');
  //       return;
  //     }
  //     if (!purchase.receiptData) {
  //       throw new Error('Apple could not locate a receipt to restore. Try purchasing again.');
  //     }
  //     await premiumMutation.mutateAsync({
  //       isPremium: true,
  //       productId: purchase.productId,
  //       transactionId: purchase.transactionId,
  //       receiptData: purchase.receiptData,
  //     });
  //     Alert.alert('Restored', 'Premium status restored on this device.');
  //   } catch (error) {
  //     Alert.alert('Restore failed', extractMessage(error));
  //   } finally {
  //     setIapBusy(false);
  //   }
  // }, [premiumMutation]);

  return (
    <ScrollView contentContainerStyle={styles.upsellContent}>
      <Text style={styles.heading}>Keep every drawing</Text>
      <Text style={styles.body}>
        Go Premium to save your full upload history, revisit previous prompts, and never worry about
        the daily cleanup.
      </Text>
      <View style={styles.upsellCard}>
        <Text style={styles.cardTitle}>Premium perks</Text>
        <Text style={styles.cardBody}>• Shields uploads from the daily sweep.</Text>
        <Text style={styles.cardBody}>• Search past posts by prompt, date, or difficulty.</Text>
        <Text style={styles.cardBody}>• Support ongoing prompt drops and moderation.</Text>
      </View>
      {productDetails?.displayPrice && (
        <Text style={styles.priceCopy}>
          {productDetails.displayPrice} billed to your Apple ID (auto-renewing subscription).
        </Text>
      )}
      <Pressable
        style={[styles.primaryButton, busy && styles.disabledButton]}
        onPress={handleUpgrade}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>{upgradeLabel}</Text>
        )}
      </Pressable>
      {/* <Pressable
        style={[styles.secondaryButton, busy && styles.disabledButton]}
        onPress={handleRestore}
        disabled={busy}
      >
        <Text style={styles.secondaryButtonText}>Restore purchase</Text>
      </Pressable> */}
      <Text style={styles.disclaimer}>
        Purchases are processed by Apple. Subscriptions renew automatically unless cancelled at
        least 24 hours before the end of the period.
      </Text>
    </ScrollView>
  );
}

const EmptyLibraryState = ({ onRefresh }: { onRefresh: () => void }) => (
  <View style={styles.emptyState}>
    <Text style={styles.cardTitle}>No uploads yet</Text>
    <Text style={styles.cardBody}>
      Finish a prompt from the home screen to start filling your personal gallery.
    </Text>
    <Pressable style={styles.retryButton} onPress={onRefresh}>
      <Text style={styles.retryButtonText}>Refresh</Text>
    </Pressable>
  </View>
);

const extractMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

const formatRelativeDate = (isoDate: string) => {
  const now = Date.now();
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return '';
  const diff = now - timestamp;
  const day = 1000 * 60 * 60 * 24;
  if (diff < day) {
    const hours = Math.max(1, Math.floor(diff / (1000 * 60 * 60)));
    return `${hours}h ago`;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoDate));
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: palette.canvas,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  body: {
    color: '#4b5563',
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 40,
    gap: 16,
    backgroundColor: palette.canvas,
  },
  listHeader: {
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.gray,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: palette.black,
    backgroundColor: '#fffef8',
  },
  errorBanner: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  errorTitle: {
    fontWeight: '600',
    color: '#b91c1c',
  },
  errorBody: {
    color: '#7f1d1d',
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  retryButtonText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: '#6b7280',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: palette.canvas,
  },
  loadingCopy: {
    color: '#4b5563',
  },
  libraryCard: {
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    backgroundColor: '#fffef8',
  },
  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  libraryPrompt: {
    fontWeight: '600',
    color: '#111827',
  },
  libraryPromptText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  libraryRemoved: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  libraryTimestamp: {
    color: '#6b7280',
    fontSize: 12,
  },
  libraryImageShell: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.gray,
  },
  libraryImage: {
    width: '100%',
    height: 240,
  },
  libraryCaption: {
    color: '#374151',
    lineHeight: 20,
  },
  imagePlaceholder: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
  },
  placeholderCopy: {
    color: '#6b7280',
  },
  retryMiniButton: {
    color: '#2563eb',
    fontWeight: '600',
  },
  upsellContent: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
    backgroundColor: palette.canvas,
  },
  upsellCard: {
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: '#fffef8',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  cardBody: {
    color: '#4b5563',
  },
  priceCopy: {
    color: '#4b5563',
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: palette.black,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.gray,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  disclaimer: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: palette.gray,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#fffef8',
  },
});
