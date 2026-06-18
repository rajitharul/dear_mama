import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmotionalCare } from '@/care/emotional/EmotionalCare';
import { FetalCare } from '@/care/fetal/FetalCare';
import { PhysicalCare } from '@/care/physical/PhysicalCare';
import { VisitsLogger } from '@/care/visits/VisitsLogger';
import type { OnboardingData } from '@/onboarding/types';
import { useTheme } from '@/theme';
import { AppText, calmRise, Card, OrganicBackdrop, Pill } from '@/ui';

type Pillar = 'physical' | 'emotional' | 'fetal' | 'visits';

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
    ready: true,
  },
  {
    key: 'fetal',
    title: 'Fetal care',
    description: 'Count baby’s kicks and note their movements.',
    icon: 'pulse-outline',
    ready: true,
  },
  {
    key: 'visits',
    title: 'Visits',
    description: 'Record appointments, prescriptions, and what to do next.',
    icon: 'medical-outline',
    ready: true,
  },
];

/**
 * The Care tab: four care pillars — Physical, Emotional, Fetal, and Visits.
 * `audience='partner'` hides Emotional care, leaving Physical / Fetal / Visits.
 */
export function CareTab({
  data,
  userId,
  onSave,
  audience = 'mother',
}: {
  data: OnboardingData;
  userId: string;
  onSave: (d: OnboardingData) => Promise<void>;
  audience?: 'mother' | 'partner';
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [view, setView] = useState<'landing' | Pillar>('landing');
  const pillars = audience === 'partner' ? PILLARS.filter((p) => p.key !== 'emotional') : PILLARS;

  if (view === 'physical') {
    return <PhysicalCare data={data} userId={userId} onSave={onSave} onBack={() => setView('landing')} />;
  }
  if (view === 'emotional') {
    return <EmotionalCare userId={userId} onBack={() => setView('landing')} />;
  }
  if (view === 'fetal') {
    return <FetalCare userId={userId} onBack={() => setView('landing')} />;
  }
  if (view === 'visits') {
    return <VisitsLogger userId={userId} onBack={() => setView('landing')} />;
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

        {pillars.map((p, i) => (
          <Animated.View key={p.key} entering={entering(90 + i * 80)}>
            <Card
              onPress={p.ready ? () => setView(p.key) : undefined}
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
