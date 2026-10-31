import { Pressable, StyleSheet, Text } from 'react-native';

import { Spacing } from '@/constants/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, color, disabled }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
  },
  dimmed: {
    opacity: 0.5,
  },
});
