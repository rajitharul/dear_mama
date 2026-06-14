import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComingSoon } from '@/care/ComingSoon';
import { PhysicalBaselineEdit } from '@/care/physical/PhysicalBaselineEdit';
import { SymptomsLogger } from '@/care/physical/SymptomsLogger';
import { VitalsLogger } from '@/care/physical/VitalsLogger';
import type { OnboardingData } from '@/onboarding/types';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, OrganicBackdrop } from '@/ui';

type Feature = {
  key: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  blurb: string;
};

const FEATURES: Feature[] = [
  {
    key: 'vitals',
    title: 'Vitals',
    description: 'Blood pressure, weight, temperature & more.',
    icon: 'pulse-outline',
    blurb: 'Log your blood pressure, weight, temperature and other vitals, and watch the gentle trends across your pregnancy.',
  },
  {
    key: 'tests',
    title: 'Test results & scans',
    description: 'Keep lab results and scan reports in one place.',
    icon: 'document-text-outline',
    blurb: 'Record your test results and store your scan reports so everything stays in one calm, private place.',
  },
  {
    key: 'actionables',
    title: 'Actionables',
    description: 'Supplements, water, medicine, monitoring & exercise.',
    icon: 'checkmark-done-outline',
    blurb: 'A gentle daily checklist for supplements, food & water, prescribed medicine, blood-sugar monitoring, any doctor-prescribed checks, and exercise.',
  },
  {
    key: 'symptoms',
    title: 'Symptoms',
    description: 'Nausea, aches, discharge and anything you notice.',
    icon: 'medkit-outline',
    blurb: 'Note symptoms like nausea, morning sickness, aches & pains, discharge or anything else you notice — ready to share with your care team.',
  },
];

/** Physical Care hub: the captured baseline + the four logging features. */
export function PhysicalCare({
  data,
  userId,
  onSave,
  onBack,
}: {
  data: OnboardingData;
  userId: string;
  onSave: (d: OnboardingData) => Promise<void>;
  onBack: () => void;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [feature, setFeature] = useState<Feature | null>(null);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <PhysicalBaselineEdit data={data} onSave={onSave} onCancel={() => setEditing(false)} />;
  }

  if (feature) {
    if (feature.key === 'vitals') {
      return <VitalsLogger userId={userId} onBack={() => setFeature(null)} />;
    }
    if (feature.key === 'symptoms') {
      return <SymptomsLogger userId={userId} onBack={() => setFeature(null)} />;
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

  type BaselineItem = { icon: keyof typeof Ionicons.glyphMap; text: string };
  const baseline: BaselineItem[] = [
    data.bloodType ? { icon: 'water-outline', text: `Blood type ${data.bloodType}` } : null,
    data.rhFactor ? { icon: 'water-outline', text: `Rh ${data.rhFactor}` } : null,
    data.prePregnancyWeight ? { icon: 'barbell-outline', text: `Pre-pregnancy weight ${data.prePregnancyWeight}` } : null,
    data.height ? { icon: 'resize-outline', text: `Height ${data.height}` } : null,
    data.conditions.length ? { icon: 'fitness-outline', text: `Conditions: ${data.conditions.join(', ')}` } : null,
    data.allergies.length ? { icon: 'alert-circle-outline', text: `Allergies: ${data.allergies.join(', ')}` } : null,
    data.medications.length
      ? { icon: 'medkit-outline', text: `Meds & supplements: ${data.medications.join(', ')}` }
      : null,
    data.priorPregnancies ? { icon: 'people-outline', text: `Prior pregnancies: ${data.priorPregnancies}` } : null,
    data.obstetricHistory.length
      ? { icon: 'reader-outline', text: `Obstetric history: ${data.obstetricHistory.join(', ')}` }
      : null,
    data.lifestyleFlags.length ? { icon: 'leaf-outline', text: `Lifestyle: ${data.lifestyleFlags.join(', ')}` } : null,
    data.medicalNotes ? { icon: 'document-text-outline', text: data.medicalNotes } : null,
  ].filter((x): x is BaselineItem => x !== null);

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
        <AppText variant="subtitle">Physical care</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={entering(0)}>
          <Card style={{ gap: t.spacing.sm }}>
            <AppText variant="label">INITIAL MEDICAL INFORMATION</AppText>
            {baseline.length ? (
              baseline.map((item) => (
                <View key={item.text} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                  <Ionicons name={item.icon} size={18} color={t.colors.accent} />
                  <AppText variant="body" style={{ flex: 1 }}>
                    {item.text}
                  </AppText>
                </View>
              ))
            ) : (
              <AppText variant="bodyMuted">No medical details added yet.</AppText>
            )}
            <Button
              label="Update"
              variant="secondary"
              icon="create-outline"
              onPress={() => setEditing(true)}
              style={{ marginTop: t.spacing.xs }}
            />
          </Card>
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
