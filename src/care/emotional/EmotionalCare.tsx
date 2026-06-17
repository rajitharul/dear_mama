import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComingSoon } from '@/care/ComingSoon';
import { BabyNoteLogger } from '@/care/emotional/BabyNoteLogger';
import { MoodLogger } from '@/care/emotional/MoodLogger';
import { useTheme } from '@/theme';
import { AppText, calmRise, Card, OrganicBackdrop } from '@/ui';

type Feature = {
  key: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  blurb: string;
};

const FEATURES: Feature[] = [
  {
    key: 'mood',
    title: 'Mood check-in',
    description: 'A quick emoji check-in on how you feel.',
    icon: 'happy-outline',
    blurb: 'Take a quiet moment to note how you’re feeling, and look back gently over time.',
  },
  {
    key: 'note_to_baby',
    title: 'Note to the baby',
    description: 'A small note to your baby, day by day.',
    icon: 'heart-outline',
    blurb: 'Leave a little note to your baby each day — a gentle keepsake of this journey to share with them one day.',
  },
];

/** Emotional Care hub: mood, rest, and weekly reflection. Only Mood is active for now. */
export function EmotionalCare({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [feature, setFeature] = useState<Feature | null>(null);

  if (feature) {
    if (feature.key === 'mood') {
      return <MoodLogger userId={userId} onBack={() => setFeature(null)} />;
    }
    if (feature.key === 'note_to_baby') {
      return <BabyNoteLogger userId={userId} onBack={() => setFeature(null)} />;
    }
    return (
      <ComingSoon
        title={feature.title}
        icon={feature.icon}
        description={feature.blurb}
        onBack={() => setFeature(null)}
      />
    );
  }

  const entering = (delay: number) => (reduce ? undefined : calmRise(delay));

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
        <AppText variant="subtitle">Emotional care</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={entering(0)} style={{ gap: t.spacing.xs }}>
          <AppText variant="bodyMuted" style={{ maxWidth: 320 }}>
            Gently tend to how you’re feeling — your emotional wellbeing matters just as much.
          </AppText>
        </Animated.View>

        <AppText variant="label">TRACK & LOG</AppText>
        {FEATURES.map((f, i) => (
          <Animated.View key={f.key} entering={entering(90 + i * 70)}>
            <Card onPress={() => setFeature(f)} style={{ gap: t.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: t.radius.md,
                    backgroundColor: t.colors.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={f.icon} size={22} color={t.colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="subtitle">{f.title}</AppText>
                  <AppText variant="bodyMuted">{f.description}</AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={t.colors.textTertiary} />
              </View>
            </Card>
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
