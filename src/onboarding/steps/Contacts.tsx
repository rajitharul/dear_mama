import { Pressable, View } from 'react-native';

import type { CareTeamRole, StepProps } from '@/onboarding/types';
import { useTheme } from '@/theme';
import { AppText, Field } from '@/ui';

const ROLES: { key: CareTeamRole; label: string }[] = [
  { key: 'ob', label: 'OB/GYN' },
  { key: 'midwife', label: 'Midwife' },
  { key: 'clinic', label: 'Clinic' },
  { key: 'other', label: 'Other' },
];

export function ContactsStep({ draft, set }: StepProps) {
  const t = useTheme();
  return (
    <>
      <AppText variant="subtitle">Emergency contact</AppText>
      <Field
        label="Name"
        placeholder="e.g. Sam"
        value={draft.emergencyName}
        onChangeText={(emergencyName) => set({ emergencyName })}
      />
      <Field
        label="Phone"
        placeholder="e.g. +1 555 123 4567"
        keyboardType="phone-pad"
        value={draft.emergencyPhone}
        onChangeText={(emergencyPhone) => set({ emergencyPhone })}
      />
      <Field
        label="Relationship"
        placeholder="e.g. Partner"
        value={draft.emergencyRelation}
        onChangeText={(emergencyRelation) => set({ emergencyRelation })}
      />

      <AppText variant="subtitle" style={{ marginTop: t.spacing.md }}>
        Care team
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
        {ROLES.map((r) => {
          const active = draft.careRole === r.key;
          return (
            <Pressable
              key={r.key}
              accessibilityRole="button"
              onPress={() => set({ careRole: r.key })}
              style={{
                paddingVertical: t.spacing.sm,
                paddingHorizontal: t.spacing.lg,
                borderRadius: t.radius.pill,
                borderWidth: 1.5,
                borderColor: active ? t.colors.accent : t.colors.border,
                backgroundColor: active ? t.colors.accentSoft : t.colors.surface,
              }}>
              <AppText variant="label" color={active ? t.colors.accent : t.colors.textSecondary}>
                {r.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <Field
        label="Provider name"
        placeholder="e.g. Dr. Patel"
        value={draft.careName}
        onChangeText={(careName) => set({ careName })}
      />
      <Field
        label="Phone"
        placeholder="Clinic or provider phone"
        keyboardType="phone-pad"
        value={draft.carePhone}
        onChangeText={(carePhone) => set({ carePhone })}
      />
      <Field
        label="Clinic / hospital"
        placeholder="e.g. City Women’s Health"
        value={draft.careClinic}
        onChangeText={(careClinic) => set({ careClinic })}
      />
    </>
  );
}
