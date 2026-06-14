import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MedicalStep } from '@/onboarding/steps/Medical';
import type { OnboardingData } from '@/onboarding/types';
import { useTheme } from '@/theme';
import { AppText, Button, Card, ChipSelect, Field, OrganicBackdrop } from '@/ui';

const OBSTETRIC_OPTIONS = [
  'C-section',
  'Miscarriage',
  'Gestational diabetes',
  'Preeclampsia',
  'Preterm birth',
  'High blood pressure',
];
const LIFESTYLE_OPTIONS = ['Smoking', 'Alcohol'];

/**
 * Direct edit form for the physical medical baseline — reuses the onboarding
 * `MedicalStep` fields but saves straight to the profile (no wizard, no rewards).
 */
export function PhysicalBaselineEdit({
  data,
  onSave,
  onCancel,
}: {
  data: OnboardingData;
  onSave: (d: OnboardingData) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState<OnboardingData>(data);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<OnboardingData>) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(draft);
      onCancel();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <OrganicBackdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            paddingHorizontal: t.spacing.xl,
            paddingTop: t.spacing.sm,
          }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={12} onPress={onCancel}>
            <Ionicons name="chevron-back" size={26} color={t.colors.text} />
          </Pressable>
          <AppText variant="subtitle">Initial medical information</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <AppText variant="bodyMuted">Update your medical baseline. Everything here is optional.</AppText>
          <Card style={{ gap: t.spacing.lg }}>
            <MedicalStep draft={draft} set={set} />
          </Card>

          <AppText variant="label">MORE ABOUT YOUR BASELINE</AppText>
          <Card style={{ gap: t.spacing.lg }}>
            <ChipSelect
              label="Rh factor"
              options={['Rh positive', 'Rh negative']}
              value={
                draft.rhFactor === 'positive'
                  ? ['Rh positive']
                  : draft.rhFactor === 'negative'
                    ? ['Rh negative']
                    : []
              }
              onChange={(next) =>
                set({
                  rhFactor:
                    next[0] === 'Rh positive' ? 'positive' : next[0] === 'Rh negative' ? 'negative' : '',
                })
              }
            />
            <Field
              label="Pre-pregnancy weight"
              placeholder="e.g. 62 kg"
              value={draft.prePregnancyWeight}
              onChangeText={(prePregnancyWeight) => set({ prePregnancyWeight })}
            />
            <Field
              label="Height"
              placeholder="e.g. 165 cm"
              value={draft.height}
              onChangeText={(height) => set({ height })}
            />
            <ChipSelect
              label="Obstetric history"
              multi
              options={OBSTETRIC_OPTIONS}
              value={draft.obstetricHistory}
              onChange={(obstetricHistory) => set({ obstetricHistory })}
              hint="Tap any that apply to previous pregnancies."
            />
            <ChipSelect
              label="Lifestyle"
              multi
              options={LIFESTYLE_OPTIONS}
              value={draft.lifestyleFlags}
              onChange={(lifestyleFlags) => set({ lifestyleFlags })}
              hint="Only if relevant — this stays private to you."
            />
          </Card>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button label={saving ? 'Saving…' : 'Save'} icon="checkmark" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
