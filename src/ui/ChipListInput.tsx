import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { useTheme } from '@/theme';

/** Add/remove a list of short string tags (conditions, allergies, etc.). */
export function ChipListInput({
  label,
  value,
  onChange,
  placeholder = 'Type and add',
}: {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const t = useTheme();
  const [text, setText] = useState('');

  function add() {
    const v = text.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setText('');
  }

  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={t.colors.textTertiary}
          onSubmitEditing={add}
          returnKeyType="done"
          style={{
            flex: 1,
            backgroundColor: t.colors.surface,
            borderWidth: 1.5,
            borderColor: t.colors.border,
            borderRadius: t.radius.md,
            paddingHorizontal: t.spacing.lg,
            paddingVertical: t.spacing.md,
            fontSize: t.fontSize.md,
            fontFamily: t.fonts.body,
            color: t.colors.text,
            minHeight: 50,
          }}
        />
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel="Add"
          style={{
            width: 50,
            height: 50,
            borderRadius: t.radius.md,
            backgroundColor: t.colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="add" size={24} color={t.colors.accent} />
        </Pressable>
      </View>
      {value.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginTop: t.spacing.xs }}>
          {value.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => onChange(value.filter((v) => v !== tag))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${tag}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.xs,
                backgroundColor: t.colors.surfaceMuted,
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.sm,
                borderRadius: t.radius.pill,
              }}>
              <AppText variant="caption" color={t.colors.textSecondary}>
                {tag}
              </AppText>
              <Ionicons name="close" size={14} color={t.colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
