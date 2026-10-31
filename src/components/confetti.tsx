import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { HabitColors } from '@/lib/habits';

const PieceCount = 48;

type Piece = { x: number; drift: number; spin: number; delay: number; duration: number; color: string; wide: boolean };

/** Deterministic spread so pieces don't need random state across renders. */
function makePieces(width: number): Piece[] {
  return Array.from({ length: PieceCount }, (_, i) => {
    const r = (n: number) => {
      const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      x: r(1) * width,
      drift: (r(2) - 0.5) * 160,
      spin: (r(3) - 0.5) * 1440,
      delay: r(4) * 500,
      duration: 2200 + r(5) * 1400,
      color: HabitColors[i % HabitColors.length],
      wide: r(6) > 0.5,
    };
  });
}

function ConfettiPiece({ piece, height }: { piece: Piece; height: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withDelay(piece.delay, withTiming(1, { duration: piece.duration, easing: Easing.in(Easing.quad) }))
    );
  }, [progress, piece]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p === 0 ? 0 : 1 - Math.max(0, p - 0.8) * 5,
      transform: [
        { translateX: piece.x + piece.drift * p },
        { translateY: -40 + (height + 80) * p },
        { rotate: `${piece.spin * p}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        { backgroundColor: piece.color, width: piece.wide ? 12 : 7, height: piece.wide ? 7 : 12 },
        style,
      ]}
    />
  );
}

/** A one-shot shower of confetti over the whole screen. Remount (change `key`) to replay. */
export function Confetti() {
  const { width, height } = useWindowDimensions();
  const pieces = makePieces(width);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <ConfettiPiece key={index} piece={piece} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 2,
  },
});
