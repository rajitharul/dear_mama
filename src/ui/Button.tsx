import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';

import { AppText } from '@/ui/AppText';
import { PressableScale } from '@/ui/PressableScale';
import { useTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const bg: Record<Variant, string> = {
    primary: t.colors.accent,
    secondary: t.colors.accentSoft,
    ghost: 'transparent',
  };
  const fg: Record<Variant, string> = {
    primary: t.colors.accentOn,
    secondary: t.colors.accent,
    ghost: t.colors.accent,
  };

  const container: ViewStyle = {
    backgroundColor: bg[variant],
    borderRadius: t.radius.md,
    paddingVertical: t.spacing.lg,
    paddingHorizontal: t.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    borderWidth: variant === 'ghost' ? 1 : 0,
    borderColor: t.colors.border,
    opacity: isDisabled ? 0.5 : 1,
  };

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ ...container, ...style }}>
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          {icon ? <Ionicons name={icon} size={18} color={fg[variant]} /> : null}
          <AppText variant="body" weight="bold" color={fg[variant]}>
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}
