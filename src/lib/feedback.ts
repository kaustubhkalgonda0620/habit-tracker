import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/**
 * Reward feedback, escalating with the size of the win:
 * - `tap`: one log on a count habit that isn't finished yet
 * - `complete`: a habit finished for the day
 * - `celebrate`: perfect day or challenge complete
 */
export type FeedbackLevel = 'tap' | 'complete' | 'celebrate';

const Sources = {
  tap: require('@/assets/sounds/tap.wav'),
  complete: require('@/assets/sounds/complete.wav'),
  celebrate: require('@/assets/sounds/celebrate.wav'),
} as const;

// Players are created on first use and kept for the life of the app, so replays are instant.
const players: Partial<Record<FeedbackLevel, AudioPlayer>> = {};

function playSound(level: FeedbackLevel) {
  try {
    players[level] ??= createAudioPlayer(Sources[level]);
    const player = players[level];
    player.seekTo(0);
    player.play();
  } catch {
    // Sound is a nice-to-have; never let it break logging.
  }
}

function playHaptic(level: FeedbackLevel) {
  const haptic =
    level === 'tap'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : level === 'complete'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  haptic.catch(() => {});
}

export function playFeedback(level: FeedbackLevel, { sound }: { sound: boolean }) {
  playHaptic(level);
  if (sound) playSound(level);
}

/** Light tick for undo / selection changes. */
export function playSelection() {
  Haptics.selectionAsync().catch(() => {});
}
