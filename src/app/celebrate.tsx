import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Confetti } from '@/components/confetti';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHabits } from '@/hooks/use-habits';
import { ChallengeBadges, ChallengeLengths, nextChallengeLength, type ChallengeLength } from '@/lib/challenges';
import { toDateKey } from '@/lib/dates';
import { currentStreak } from '@/lib/habits';

const AccentColor = '#F76B15';

function dismiss() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function parseLength(value: string | undefined): ChallengeLength | null {
  const length = Number(value);
  return ChallengeLengths.find((option) => option === length) ?? null;
}

export default function CelebrateScreen() {
  const params = useLocalSearchParams<{ kind?: string; length?: string }>();
  const { habits, startChallenge } = useHabits();
  const length = params.kind === 'challenge' ? parseLength(params.length) : null;

  const cardScale = useSharedValue(0.6);
  const emojiScale = useSharedValue(0);

  useEffect(() => {
    cardScale.set(withSpring(1, { damping: 11, stiffness: 160 }));
    emojiScale.set(
      withDelay(
        200,
        withSequence(
          withSpring(1.25, { damping: 5, stiffness: 200 }),
          withRepeat(withSequence(withTiming(1.08, { duration: 600 }), withTiming(1, { duration: 600 })), -1)
        )
      )
    );
  }, [cardScale, emojiScale]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.get() }] }));
  const emojiStyle = useAnimatedStyle(() => ({ transform: [{ scale: emojiScale.get() }] }));

  const longestActiveStreak = Math.max(0, ...habits.map((habit) => currentStreak(habit)));
  const todayCount = habits.length;

  let emoji = '🎉';
  let title = 'Perfect day!';
  let body = `All ${todayCount} habit${todayCount === 1 ? '' : 's'} done for ${new Date().toLocaleDateString(undefined, { weekday: 'long' })}.`;
  if (longestActiveStreak > 1) body += ` Your best streak is now ${longestActiveStreak} days.`;
  let action: React.ReactNode = <PrimaryButton label="Nice!" color={AccentColor} onPress={dismiss} />;

  if (length) {
    const badge = ChallengeBadges[length];
    const next = nextChallengeLength(length);
    emoji = badge.emoji;
    title = `${length}-day challenge complete!`;
    body = `You earned the “${badge.title}” badge. ${length} perfect days in a row. That's how habits are made.`;
    action = (
      <>
        <PrimaryButton
          label={`Start the ${next}-day challenge`}
          color={AccentColor}
          onPress={() => {
            startChallenge(next);
            dismiss();
          }}
        />
        <Pressable onPress={dismiss} style={styles.secondary}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Not now
          </ThemedText>
        </Pressable>
      </>
    );
  }

  return (
    <View style={styles.backdrop}>
      <Confetti key={`${params.kind}-${toDateKey(new Date())}`} />
      <Animated.View style={[styles.cardWrapper, cardStyle]}>
        <ThemedView style={styles.card}>
          <Animated.View style={emojiStyle}>
            <Text style={styles.emoji}>{emoji}</Text>
          </Animated.View>
          {length && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              BADGE UNLOCKED · {ChallengeBadges[length].title.toUpperCase()}
            </ThemedText>
          )}
          <ThemedText type="subtitle" style={styles.center}>
            {title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {body}
          </ThemedText>
          <View style={styles.actions}>{action}</View>
        </ThemedView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
    borderRadius: Spacing.five,
  },
  emoji: {
    fontSize: 80,
    lineHeight: 96,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  secondary: {
    alignItems: 'center',
    padding: Spacing.two,
  },
});
