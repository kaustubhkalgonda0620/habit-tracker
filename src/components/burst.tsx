import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const Rays = 10;
const Distance = 34;

function Ray({ index, color, progress }: { index: number; color: string; progress: SharedValue<number> }) {
  const angle = (index / Rays) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: 1 - p,
      transform: [
        { translateX: Math.cos(angle) * Distance * p },
        { translateY: Math.sin(angle) * Distance * p },
        { scale: 1.2 - p * 0.8 },
      ],
    };
  });
  return <Animated.View style={[styles.ray, { backgroundColor: color }, style]} />;
}

/** Radiating dots centered on its parent. Fires each time `active` turns on (not on mount). */
export function Burst({ active, color }: { active: boolean; color: string }) {
  const progress = useSharedValue(1);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) {
      progress.set(0);
      progress.set(withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
    }
    wasActive.current = active;
  }, [active, progress]);

  return (
    <View pointerEvents="none" style={styles.container}>
      {Array.from({ length: Rays }, (_, index) => (
        <Ray key={index} index={index} color={color} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
