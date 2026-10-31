import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHabits } from '@/hooks/use-habits';
import { useTheme } from '@/hooks/use-theme';
import {
  ChallengeBadges,
  challengeProgress,
  nextChallengeLength,
  type ChallengeLength,
} from '@/lib/challenges';

const AccentColor = '#F76B15';

function StartButton({ length, label }: { length: ChallengeLength; label: string }) {
  const { startChallenge } = useHabits();
  return <PrimaryButton label={label} color={AccentColor} onPress={() => startChallenge(length)} />;
}

/** The challenge in progress, or an invitation to start the next one. */
export function ChallengeCard() {
  const theme = useTheme();
  const { challenge, habits, badges, todayKey } = useHabits();

  if (!challenge) {
    const next = nextChallengeLength(badges.at(-1)?.length ?? null);
    const badge = ChallengeBadges[next];
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
          <View style={styles.headerText}>
            <ThemedText type="smallBold">Take on a {next}-day challenge</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Finish every habit {next} days in a row to earn “{badge.title}”.
            </ThemedText>
          </View>
        </View>
        <StartButton length={next} label={`Start ${next}-day challenge`} />
      </ThemedView>
    );
  }

  const progress = challengeProgress(challenge, habits, todayKey);
  const badge = ChallengeBadges[challenge.length];

  if (progress.status === 'failed') {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.badgeEmoji}>💪</Text>
          <View style={styles.headerText}>
            <ThemedText type="smallBold">Your {challenge.length}-day challenge slipped</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              You made it {progress.daysDone} day{progress.daysDone === 1 ? '' : 's'}. Streaks are
              built on restarts.
            </ThemedText>
          </View>
        </View>
        <StartButton length={challenge.length} label="Start again today" />
      </ThemedView>
    );
  }

  const message = progress.todayDone
    ? progress.daysDone === challenge.length - 1
      ? 'Today is in the bag. One more day to go!'
      : 'Today is in the bag. See you tomorrow!'
    : progress.dayNumber === challenge.length
      ? 'Final day. Finish every habit to earn your badge!'
      : 'Finish every habit today to keep the chain going.';

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
        <View style={styles.headerText}>
          <ThemedText type="small" themeColor="textSecondary">
            {challenge.length}-day challenge
          </ThemedText>
          <ThemedText type="smallBold">
            Day {progress.dayNumber} of {challenge.length}
          </ThemedText>
        </View>
        <ThemedText type="smallBold" style={{ color: AccentColor }}>
          {progress.daysDone}/{challenge.length}
        </ThemedText>
      </View>
      <View style={styles.segments}>
        {Array.from({ length: challenge.length }, (_, day) => (
          <View
            key={day}
            style={[
              styles.segment,
              {
                backgroundColor: day < progress.daysDone ? AccentColor : theme.backgroundSelected,
                borderColor: day === progress.dayNumber - 1 && !progress.todayDone ? AccentColor : 'transparent',
              },
            ]}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {message}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  segments: {
    flexDirection: 'row',
    gap: 3,
  },
  segment: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
