import { Pressable, View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { useTheme } from '@/theme';

/**
 * A row of selectable preset chips. `multi` toggles many; otherwise it's a
 * single-choice group (tapping the active chip clears it). Selected values are
 * the option strings themselves, stored as a string[] (length 0 or 1 when single).
 */
export function ChipSelect({
  label,
  options,
  value,
  onChange,
  multi = false,
  hint,
}: {
  label?: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
  hint?: string;
}) {
  const t = useTheme();

  function toggle(opt: string) {
    const selected = value.includes(opt);
    if (multi) {
      onChange(selected ? value.filter((v) => v !== opt) : [...value, opt]);
    } else {
      onChange(selected ? [] : [opt]);
    }
  }

  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => toggle(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={opt}
              style={{
                paddingHorizontal: t.spacing.lg,
                paddingVertical: t.spacing.sm,
                borderRadius: t.radius.pill,
                borderWidth: 1.5,
                borderColor: selected ? t.colors.accent : t.colors.border,
                backgroundColor: selected ? t.colors.accentSoft : t.colors.surface,
                minHeight: 44,
                justifyContent: 'center',
              }}>
              <AppText variant="body" color={selected ? t.colors.accent : t.colors.textSecondary}>
                {opt}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
    </View>
  );
}
