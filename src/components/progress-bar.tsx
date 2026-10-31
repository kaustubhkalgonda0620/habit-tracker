import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type ProgressBarProps = {
  /** 0–1 */
  progress: number;
  color: string;
  height?: number;
};

export function ProgressBar({ progress, color, height = 8 }: ProgressBarProps) {
  const theme = useTheme();
  const percent = `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` as const;

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: percent, borderRadius: height / 2, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  fill: {
    height: '100%',
  },
});
