import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText, calmRise, OrganicBackdrop, Pill } from '@/ui';

/** Placeholder for a Care feature that's designed but not yet built. */
export function ComingSoon({
  title,
  icon,
  description,
  onBack,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  onBack: () => void;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <OrganicBackdrop />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          paddingHorizontal: t.spacing.xl,
          paddingTop: t.spacing.sm,
        }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={onBack}>
          <Ionicons name="chevron-back" size={26} color={t.colors.text} />
        </Pressable>
        <AppText variant="subtitle">{title}</AppText>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xxl, gap: t.spacing.lg }}>
        <Animated.View
          entering={reduce ? undefined : calmRise(0)}
          style={{
            width: 96,
            height: 96,
            borderRadius: t.radius.xl,
            backgroundColor: t.colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={icon} size={44} color={t.colors.accent} />
        </Animated.View>
        <Animated.View entering={reduce ? undefined : calmRise(120)} style={{ alignItems: 'center', gap: t.spacing.sm }}>
          <Pill label="Coming soon" tone="accent" icon="time-outline" />
          <AppText variant="title" center>
            {title}
          </AppText>
          <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
            {description}
          </AppText>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
