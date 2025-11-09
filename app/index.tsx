import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Link } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { countDownToUtcMidnight, formatCountdown } from '@/lib/dates';
import { useTodayPrompts } from '@/lib/queries';
import {
  DailyPrompt,
  PROMPT_DIFFICULTIES,
  PromptDifficulty,
  difficultyLabels,
} from '@/types/prompt';

const rules = [
  'One original upload per prompt per day.',
  'Respect the community: keep submissions safe for work.',
  'No AI, traced, or watermarked pieces.',
  'Report anything that feels off—moderators review every flag.',
];

export default function TodayScreen() {
  const [showRules, setShowRules] = useState(false);
  const sheetOffset = useRef(new Animated.Value(400)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const countdownMs = useUtcCountdown();
  const countdownLabel = formatCountdown(countdownMs);
  const { data: prompts = [], isLoading, isError, isRefetching, refetch } = useTodayPrompts();

  const promptsByDifficulty = useMemo(() => {
    const lookup: Partial<Record<PromptDifficulty, DailyPrompt>> = {};
    prompts.forEach((prompt) => {
      lookup[prompt.difficulty] = prompt;
    });
    return lookup;
  }, [prompts]);

  const animateSheet = useCallback(
    (toValue: number, opacity: number, callback?: () => void) => {
      Animated.parallel([
        Animated.timing(sheetOffset, {
          toValue,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: opacity,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && callback) callback();
      });
    },
    [overlayOpacity, sheetOffset],
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0 && showRules) {
          sheetOffset.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 1) {
          animateSheet(400, 0, () => setShowRules(false));
        } else {
          Animated.spring(sheetOffset, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetOffset, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (showRules) {
      sheetOffset.setValue(400);
      overlayOpacity.setValue(0);
      requestAnimationFrame(() => {
        animateSheet(0, 1);
      });
    } else {
      sheetOffset.setValue(400);
      overlayOpacity.setValue(0);
    }
  }, [animateSheet, overlayOpacity, sheetOffset, showRules]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <Text style={styles.heading}>Today&apos;s Four</Text>
        <Text style={styles.subheading}>
          Daily prompts refresh at midnight UTC. Tap any card to jump into the prompt thread and
          upload your work.
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.countdownLabel}>Next refresh in {countdownLabel} (UTC)</Text>
          <Pressable
            onPress={() => refetch()}
            disabled={isRefetching}
            style={[styles.refreshButton, isRefetching && styles.refreshButtonDisabled]}
          >
            <Text style={styles.refreshButtonText}>{isRefetching ? 'Refreshing…' : 'Refresh'}</Text>
          </Pressable>
        </View>
        {isLoading && !prompts.length && (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Fetching today&apos;s prompts…</Text>
          </View>
        )}
        {isError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Unable to load prompts. Pull to refresh and try again.
            </Text>
          </View>
        )}
        <Pressable style={styles.rulesButton} onPress={() => setShowRules(true)}>
          <Text style={styles.rulesButtonText}>View Rules</Text>
        </Pressable>
        <View style={styles.grid}>
          {PROMPT_DIFFICULTIES.map((difficulty) => (
            <PromptCard
              key={difficulty}
              difficulty={difficulty}
              prompt={promptsByDifficulty[difficulty] ?? null}
            />
          ))}
        </View>
        <View style={styles.footerLinks}>
          <Link href="/library" style={styles.footerLink}>
            Library
          </Link>
          <Link href="/settings" style={styles.footerLink}>
            Settings
          </Link>
        </View>
      </ScrollView>
      <Modal
        visible={showRules}
        animationType="fade"
        transparent
        onRequestClose={() => animateSheet(400, 0, () => setShowRules(false))}
      >
        <Animated.View style={[styles.modalBackdrop, { opacity: overlayOpacity }]}>
          <Pressable
            style={styles.backdropTouchable}
            onPress={() => animateSheet(400, 0, () => setShowRules(false))}
          />
        </Animated.View>
        <Animated.View
          style={[styles.modalSheet, { transform: [{ translateY: sheetOffset }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>DailyDraw Rules</Text>
          <View style={styles.modalBody}>
            {rules.map((rule) => (
              <Text key={rule} style={styles.modalRule}>
                • {rule}
              </Text>
            ))}
          </View>
          <Pressable
            style={styles.modalCloseButton}
            onPress={() => animateSheet(400, 0, () => setShowRules(false))}
          >
            <Text style={styles.modalCloseText}>Got it</Text>
          </Pressable>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 24,
    paddingBottom: 48,
    gap: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
  },
  subheading: {
    color: '#555',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  countdownLabel: {
    color: '#4b5563',
    fontWeight: '600',
  },
  refreshButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    fontWeight: '600',
    color: '#1f2937',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#4b5563',
  },
  errorBanner: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#b91c1c',
  },
  grid: {
    gap: 12,
  },
  rulesButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1f75ff',
  },
  rulesButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    backgroundColor: '#fff',
    gap: 8,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  cardDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
  },
  cardHint: {
    marginTop: 2,
    color: '#888',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  footerLink: {
    fontWeight: '600',
    color: '#1f75ff',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  backdropTouchable: {
    flex: 1,
  },
  modalSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#ddd',
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalBody: {
    gap: 8,
  },
  modalRule: {
    color: '#444',
  },
  modalCloseButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1f75ff',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '600',
  },
});

type PromptCardProps = {
  difficulty: PromptDifficulty;
  prompt: DailyPrompt | null;
};

function PromptCard({ difficulty, prompt }: PromptCardProps) {
  const content = (
    <>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{difficultyLabels[difficulty]}</Text>
        {prompt && <Text style={styles.cardDate}>{formatPromptDate(prompt.promptDate)}</Text>}
      </View>
      <Text style={styles.cardTitle}>
        {prompt ? prompt.promptText : 'Awaiting prompt for this slot'}
      </Text>
      <Text style={styles.cardHint}>
        {prompt ? 'Tap to open the thread' : 'We will notify you when this prompt unlocks.'}
      </Text>
    </>
  );

  if (!prompt) {
    return <View style={[styles.card, styles.cardDisabled]}>{content}</View>;
  }

  return (
    <Link
      href={{
        pathname: '/t/[date]/[difficulty]',
        params: {
          date: prompt.promptDate.slice(0, 10),
          difficulty: prompt.difficulty,
        },
      }}
      asChild
    >
      <Pressable style={styles.card}>{content}</Pressable>
    </Link>
  );
}

function formatPromptDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDate));
}

function useUtcCountdown() {
  const [remaining, setRemaining] = useState(() => countDownToUtcMidnight());

  useEffect(() => {
    const interval = setInterval(() => setRemaining(countDownToUtcMidnight()), 1000);
    return () => clearInterval(interval);
  }, []);

  return remaining;
}
