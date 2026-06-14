import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/ui/AppText';
import { useTheme } from '@/theme';

export function Field({
  label,
  error,
  hint,
  style,
  ...inputProps
}: TextInputProps & { label?: string; error?: string; hint?: string }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        placeholderTextColor={t.colors.textTertiary}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: t.colors.surface,
            borderWidth: 1.5,
            borderColor: error ? t.colors.danger : focused ? t.colors.accent : t.colors.border,
            borderRadius: t.radius.md,
            paddingHorizontal: t.spacing.lg,
            paddingVertical: t.spacing.md,
            fontSize: t.fontSize.md,
            fontFamily: t.fonts.body,
            color: t.colors.text,
            minHeight: 50,
          },
          inputProps.multiline && { minHeight: 96, textAlignVertical: 'top' },
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" color={t.colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
}
