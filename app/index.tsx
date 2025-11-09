import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Link } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  Image,
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

const palette = {
  black: '#2B2B2B',
  canvas: '#f5e8d3ff',
  gray: '#D1CFCB',
  yellow: '#FFD764',
  coral: '#F57C73',
};

const rules = [
  'One original upload per prompt per day. Prompts refresh at midnight UTC daily!',
  'Respect the community: keep submissions safe for work.',
  'No AI generated art',
  'Report anything that feels off—moderators review every flag.',
];

const footerTabs = [
  { href: '/library', title: 'Library', icon: '📚' },
  { href: '/settings', title: 'Settings', icon: '⚙️' },
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
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/dailydrawlogo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Pressable style={styles.rulesButton} onPress={() => setShowRules(true)}>
            <Text style={styles.rulesButtonText}>View Rules</Text>
          </Pressable>
        </View>

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
            <ActivityIndicator color={palette.black} />
            <Text style={styles.loadingText}>Fetching today&apos;s prompts…</Text>
          </View>
        )}
        {isError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>Unable to load prompts. Pull to refresh and try again.</Text>
          </View>
        )}

        <View style={styles.grid}>
          {PROMPT_DIFFICULTIES.map((difficulty) => (
            <PromptCard
              key={difficulty}
              difficulty={difficulty}
              prompt={promptsByDifficulty[difficulty] ?? null}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomDock} pointerEvents="box-none">
        <View style={styles.bottomDockInner}>
          {footerTabs.map((tab) => (
            <Link key={tab.href} href={tab.href} asChild>
              <Pressable style={styles.dockButton}>
                <View style={styles.dockIcon}>
                  <Text style={styles.dockIconText}>{tab.icon}</Text>
                </View>
                <Text style={styles.dockLabel}>{tab.title}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>

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
          <Text style={styles.modalIntro}>
            Guidelines to keep our community fun, productive, and safe!
          </Text>
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
    backgroundColor: palette.canvas,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 72,
    gap: 16,
  },
  hero: {
    gap: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoImage: {
    width: '65%',
    height: 72,
    marginLeft: '-10%',
    top: '-15%',
  },
  heroBadge: {
    display: 'none',
  },
  heading: {
    fontSize: 32,
    lineHeight: 38,
    color: palette.black,
    fontWeight: '700',
  },
  headingAccent: {
    backgroundColor: palette.yellow,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  tagline: {
    color: palette.black,
    opacity: 0.8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  countdownLabel: {
    color: palette.black,
  },
  refreshButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.gray,
    backgroundColor: '#fff',
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    fontWeight: '600',
    color: palette.black,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: palette.black,
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
  rulesButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.coral,
  },
  rulesButtonText: {
    color: palette.black,
    fontWeight: '600',
  },
  grid: {
    gap: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.gray,
    padding: 16,
    backgroundColor: '#fff',
    gap: 8,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  cardLabel: {
    fontSize: 12,
    color: palette.black,
  },
  cardDate: {
    fontSize: 12,
    color: palette.gray,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.black,
  },
  cardHint: {
    color: palette.black,
    opacity: 0.6,
  },
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  bottomDockInner: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 999,
    borderWidth: 0,
    borderColor: palette.gray,
    paddingHorizontal: 26,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 100,
  },
  dockButton: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dockIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.coral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockIconText: {
    fontSize: 24,
    color: palette.black,
  },
  dockLabel: {
    fontSize: 12,
    color: palette.black,
    fontWeight: '600',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHandle: {
    width: 48,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.gray,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: palette.black,
  },
  modalIntro: {
    textAlign: 'center',
    color: palette.black,
  },
  modalBody: {
    gap: 8,
  },
  modalRule: {
    color: palette.black,
  },
  modalCloseButton: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: palette.coral,
  },
  modalCloseText: {
    color: palette.black,
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
