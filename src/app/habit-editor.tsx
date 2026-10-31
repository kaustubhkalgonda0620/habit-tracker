import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HabitFields } from '@/components/habit-fields';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenScrollView } from '@/components/screen-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHabits } from '@/hooks/use-habits';
import { confirmAction } from '@/lib/confirm';
import { HabitColors, HabitEmojis, type NewHabit } from '@/lib/habits';

const BlankHabit: NewHabit = {
  name: '',
  emoji: HabitEmojis[0],
  color: HabitColors[0],
  kind: 'check',
  target: 1,
  intentionTime: null,
};

function dismiss() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function HabitEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { habits, addHabit, updateHabit, deleteHabit } = useHabits();
  const existing = habits.find((habit) => habit.id === id);
  const [draft, setDraft] = useState<NewHabit>(() =>
    existing
      ? {
          name: existing.name,
          emoji: existing.emoji,
          color: existing.color,
          kind: existing.kind,
          target: existing.target,
          intentionTime: existing.intentionTime,
        }
      : BlankHabit
  );

  const canSave = draft.name.trim().length > 0;

  function save() {
    if (!canSave) return;
    const habit = { ...draft, name: draft.name.trim() };
    if (existing) updateHabit(existing.id, habit);
    else addHabit(habit);
    dismiss();
  }

  function confirmDelete() {
    if (!existing) return;
    confirmAction('Delete habit?', `"${existing.name}" and its history will be removed.`, 'Delete', () => {
      deleteHabit(existing.id);
      dismiss();
    });
  }

  return (
    <ScreenScrollView standalone>
      <View style={styles.header}>
        <Pressable onPress={dismiss} hitSlop={12}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Cancel
          </ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{existing ? 'Edit habit' : 'New habit'}</ThemedText>
        <Pressable onPress={save} disabled={!canSave} hitSlop={12}>
          <ThemedText type="smallBold" style={{ color: draft.color, opacity: canSave ? 1 : 0.4 }}>
            Save
          </ThemedText>
        </Pressable>
      </View>

      <HabitFields value={draft} onChange={setDraft} onSubmit={save} />

      <PrimaryButton
        label={existing ? 'Save changes' : 'Add habit'}
        color={draft.color}
        onPress={save}
        disabled={!canSave}
      />

      {existing && (
        <Pressable onPress={confirmDelete} style={styles.delete}>
          <ThemedText type="smallBold" style={styles.deleteLabel}>
            Delete habit
          </ThemedText>
        </Pressable>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  delete: {
    alignSelf: 'center',
    padding: Spacing.three,
  },
  deleteLabel: {
    color: '#E5484D',
  },
});
