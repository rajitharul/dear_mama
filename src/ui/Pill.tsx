import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { useTheme } from '@/theme';

type Tone = 'neutral' | 'accent' | 'success' | 'danger';

export function Pill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const t = useTheme();
  const tones: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: t.colors.surfaceMuted, fg: t.colors.textSecondary },
    accent: { bg: t.colors.accentSoft, fg: t.colors.accent },
    success: { bg: t.colors.successSoft, fg: t.colors.success },
    danger: { bg: t.colors.dangerSoft, fg: t.colors.danger },
  };
  const c = tones[tone];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        backgroundColor: c.bg,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.xs,
        borderRadius: t.radius.pill,
        alignSelf: 'flex-start',
      }}>
      {icon ? <Ionicons name={icon} size={12} color={c.fg} /> : null}
      <AppText variant="caption" color={c.fg}>
        {label}
      </AppText>
    </View>
  );
}
