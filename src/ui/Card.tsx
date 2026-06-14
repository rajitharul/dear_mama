import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { PressableScale } from '@/ui/PressableScale';
import { useTheme } from '@/theme';

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: t.spacing.lg,
    ...t.shadow.card,
  };

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={{ ...base, ...style }}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
