import { Platform, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenScrollViewProps = ScrollViewProps & {
  /** For screens outside the tabs (modals, onboarding): no tab bar to clear. */
  standalone?: boolean;
};

/** Scrollable screen body that clears the status bar and tab bar on every platform. */
export function ScreenScrollView({ children, standalone, ...rest }: ScreenScrollViewProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const padding = {
    paddingTop: standalone
      ? insets.top + Spacing.four
      : Platform.select({ web: 88, default: insets.top + Spacing.three }),
    paddingBottom: insets.bottom + (standalone ? 0 : BottomTabInset) + Spacing.four,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, padding]}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      {...rest}>
      <ThemedView style={styles.container}>{children}</ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    // Explicit width so wrapping rows (chips, pickers) wrap instead of widening the page.
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});
