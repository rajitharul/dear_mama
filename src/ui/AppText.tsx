import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'subtitle' | 'body' | 'bodyMuted' | 'label' | 'caption';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

export type AppTextProps = TextProps & {
  variant?: Variant;
  color?: string;
  center?: boolean;
  weight?: Weight;
};

export function AppText({ variant = 'body', color, center, weight, style, ...rest }: AppTextProps) {
  const t = useTheme();

  const bodyFamily: Record<Weight, string> = {
    regular: t.fonts.body,
    medium: t.fonts.medium,
    semibold: t.fonts.semibold,
    bold: t.fonts.bold,
  };

  const config: Record<Variant, { size: number; family: string; color: string; lineHeight?: number }> = {
    display: { size: t.fontSize.xxxl, family: t.fonts.display, color: t.colors.text, lineHeight: t.fontSize.xxxl * 1.15 },
    title: { size: t.fontSize.xxl, family: t.fonts.display, color: t.colors.text, lineHeight: t.fontSize.xxl * 1.2 },
    heading: { size: t.fontSize.xl, family: t.fonts.display, color: t.colors.text },
    subtitle: { size: t.fontSize.lg, family: t.fonts.semibold, color: t.colors.text },
    body: { size: t.fontSize.md, family: t.fonts.body, color: t.colors.text, lineHeight: t.fontSize.md * 1.5 },
    bodyMuted: { size: t.fontSize.md, family: t.fonts.body, color: t.colors.textSecondary, lineHeight: t.fontSize.md * 1.5 },
    label: { size: t.fontSize.sm, family: t.fonts.semibold, color: t.colors.textSecondary },
    caption: { size: t.fontSize.xs, family: t.fonts.semibold, color: t.colors.textTertiary },
  };

  const c = config[variant];
  const isHeading = variant === 'display' || variant === 'title' || variant === 'heading';
  const family = weight && !isHeading ? bodyFamily[weight] : c.family;

  const textStyle: TextStyle = {
    fontFamily: family,
    fontSize: c.size,
    color: color ?? c.color,
    ...(c.lineHeight ? { lineHeight: c.lineHeight } : null),
  };

  return <Text style={[textStyle, center && { textAlign: 'center' }, style]} {...rest} />;
}
