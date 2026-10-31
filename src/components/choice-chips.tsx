import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { playSelection } from '@/lib/feedback';

type ChoiceChipsProps<T> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Fill color for the selected chip. */
  color: string;
};

/** A wrapping row of single-select pills. */
export function ChoiceChips<T>({ options, value, onChange, color }: ChoiceChipsProps<T>) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => {
              playSelection();
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, { backgroundColor: selected ? color : theme.background }]}>
            <ThemedText type="smallBold" style={selected ? styles.selectedLabel : undefined}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  selectedLabel: {
    color: '#ffffff',
  },
});
