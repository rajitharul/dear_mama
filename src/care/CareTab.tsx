import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhysicalCare } from '@/care/physical/PhysicalCare';
import type { OnboardingData } from '@/onboarding/types';
import { useTheme } from '@/theme';
import { AppText, calmRise, Card, OrganicBackdrop, Pill } from '@/ui';

type Pillar = 'physical' | 'emotional' | 'fetal';

const PILLARS: {
  key: Pillar;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  ready: boolean;
}[] = [
  {
    key: 'physical',
    title: 'Physical care',
    description: 'Vitals, tests & scans, daily actionables, and symptoms.',
    icon: 'fitness-outline',
    ready: true,
  },
  {
    key: 'emotional',
    title: 'Emotional care',
    description: 'Mood, rest, and how you’re feeling week to week.',
    icon: 'happy-outline',
    ready: false,
  },
  {
    key: 'fetal',
    title: 'Fetal care',
    description: 'Baby’s growth, movements, and milestones.',
    icon: 'pulse-outline',
    ready: false,
  },
];

/** The Care tab: three care pillars. Only Physical is active for now. */
export function CareTab({
  data,
  onSave,
}: {
  data: OnboardingData;
  onSave: (d: OnboardingData) => Promise<void>;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [view, setView] = useState<'landing' | 'physical'>('landing');

  if (view === 'physical') {
    return <PhysicalCare data={data} onSave={onSave} onBack={() => setView('landing')} />;
  }

  const entering = (delay: number) => (reduce ? undefined : calmRise(delay));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <OrganicBackdrop />
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.xl, gap: t.spacing.lg, paddingBottom: t.spacing.xxxl }}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={entering(0)} style={{ gap: t.spacing.xs }}>
          <AppText variant="bodyMuted">Your care</AppText>
          <AppText variant="display">Care</AppText>
          <AppText variant="bodyMuted" style={{ maxWidth: 320 }}>
            Gently track how you and baby are doing across three areas of care.
          </AppText>
        </Animated.View>

        {PILLARS.map((p, i) => (
          <Animated.View key={p.key} entering={entering(90 + i * 80)}>
            <Card
              onPress={p.ready ? () => setView('physical') : undefined}
              style={{ gap: t.spacing.sm, opacity: p.ready ? 1 : 0.7 }}>
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
                  <Ionicons name={p.icon} size={22} color={t.colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="subtitle">{p.title}</AppText>
                  <AppText variant="bodyMuted">{p.description}</AppText>
                </View>
                {p.ready ? (
                  <Ionicons name="chevron-forward" size={20} color={t.colors.textTertiary} />
                ) : null}
              </View>
              {p.ready ? null : <Pill label="Coming soon" tone="neutral" icon="time-outline" />}
            </Card>
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
