import { useEffect, useRef, useState } from 'react';

import { Link } from 'expo-router';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const today = new Date().toISOString().slice(0, 10);
const mockDifficulties = ['very easy', 'easy', 'medium', 'advanced'] as const;
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

  const animateSheet = (toValue: number, opacity: number, callback?: () => void) => {
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
  };

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
  }, [showRules, sheetOffset, overlayOpacity]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.heading}>Today&apos;s Four</Text>
        <Text style={styles.subheading}>
          This screen will call `/prompts/today` via TanStack Query and render prompt cards. For now
          use the links below to navigate to the thread template for each difficulty.
        </Text>
        <Pressable style={styles.rulesButton} onPress={() => setShowRules(true)}>
          <Text style={styles.rulesButtonText}>View Rules</Text>
        </Pressable>
        <View style={styles.grid}>
          {mockDifficulties.map((difficulty) => (
            <Link
              key={difficulty}
              href={{ pathname: '/t/[date]/[difficulty]', params: { date: today, difficulty } }}
              style={styles.card}
            >
              <Text style={styles.cardLabel}>{difficulty.toUpperCase()}</Text>
              <Text style={styles.cardTitle}>Prompt placeholder</Text>
              <Text style={styles.cardHint}>Tap to open the thread</Text>
            </Link>
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
    gap: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
  },
  subheading: {
    color: '#555',
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
    padding: 16,
    backgroundColor: '#fff',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  cardTitle: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '600',
  },
  cardHint: {
    marginTop: 4,
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
