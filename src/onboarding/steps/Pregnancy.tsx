import { Ionicons } from '@expo/vector-icons';
import { addDays, format } from 'date-fns';
import { Pressable, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { BABY_COUNT_OPTIONS, DATE_SOURCE_OPTIONS } from '@/onboarding/labels';
import type { StepProps } from '@/onboarding/types';
import { eddFromLmp, gestationalAge, lmpFromEdd } from '@/pregnancy/weekMath';
import { useTheme } from '@/theme';
import { AppText, calmRise, DateField, Field } from '@/ui';

export function PregnancyStep({ draft, set }: StepProps) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const chosen = draft.date ? new Date(draft.date) : null;
  const edd = chosen ? (draft.dateMode === 'edd' ? chosen : eddFromLmp(chosen)) : null;
  const otherLabel =
    chosen && draft.dateMode === 'edd'
      ? `Last period ≈ ${format(lmpFromEdd(chosen), 'd MMM yyyy')}`
      : chosen
        ? `Due date ≈ ${format(eddFromLmp(chosen), 'd MMM yyyy')}`
        : null;
  const ga = edd ? gestationalAge(edd) : null;

  const modes = [
    { key: 'edd' as const, label: 'I know my due date' },
    { key: 'lmp' as const, label: 'I know my last period' },
  ];

  return (
    <>
      <View style={{ gap: t.spacing.xs }}>
        <AppText variant="label">Which date do you have?</AppText>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          {modes.map((m) => {
            const active = draft.dateMode === m.key;
            return (
              <Pressable
                key={m.key}
                accessibilityRole="button"
                onPress={() => set({ dateMode: m.key, date: null, dateSource: null, dueDateDoctor: '' })}
                style={{
                  flex: 1,
                  paddingVertical: t.spacing.md,
                  paddingHorizontal: t.spacing.sm,
                  borderRadius: t.radius.md,
                  borderWidth: 1.5,
                  borderColor: active ? t.colors.accent : t.colors.border,
                  backgroundColor: active ? t.colors.accentSoft : t.colors.surface,
                  alignItems: 'center',
                }}>
                <AppText variant="label" color={active ? t.colors.accent : t.colors.textSecondary} center>
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <DateField
        label={draft.dateMode === 'edd' ? 'Estimated due date' : 'First day of last period'}
        value={chosen}
        onChange={(d) => set({ date: d.toISOString().slice(0, 10) })}
        minimumDate={draft.dateMode === 'edd' ? new Date() : addDays(new Date(), -300)}
        maximumDate={draft.dateMode === 'edd' ? addDays(new Date(), 300) : new Date()}
      />

      {otherLabel && ga ? (
        <AppText variant="caption" color={t.colors.accent}>
          {otherLabel} · you’re around week {ga.weeks}
        </AppText>
      ) : null}

      {/* Due-date follow-up: doctor vs self */}
      {draft.dateMode === 'edd' ? (
        <View style={{ gap: t.spacing.xs }}>
          <AppText variant="label">How was this date determined?</AppText>
          <View style={{ gap: t.spacing.sm }}>
            {DATE_SOURCE_OPTIONS.map((opt) => {
              const active = draft.dateSource === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  onPress={() =>
                    set({ dateSource: opt.value, ...(opt.value === 'self' ? { dueDateDoctor: '' } : {}) })
                  }
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.spacing.md,
                    paddingVertical: t.spacing.md,
                    paddingHorizontal: t.spacing.lg,
                    borderRadius: t.radius.md,
                    borderWidth: 1.5,
                    borderColor: active ? t.colors.accent : t.colors.border,
                    backgroundColor: active ? t.colors.accentSoft : t.colors.surface,
                  }}>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? t.colors.accent : t.colors.textTertiary}
                  />
                  <AppText variant="body" color={active ? t.colors.accent : t.colors.text}>
                    {opt.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {draft.dateSource === 'doctor' ? (
            <Animated.View entering={reduce ? undefined : calmRise(0)} style={{ marginTop: t.spacing.sm }}>
              <Field
                label="Which doctor confirmed it?"
                placeholder="e.g. Dr. Patel"
                value={draft.dueDateDoctor}
                onChangeText={(dueDateDoctor) => set({ dueDateDoctor })}
              />
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {/* How many babies */}
      <View style={{ gap: t.spacing.xs }}>
        <AppText variant="label">How many babies?</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {BABY_COUNT_OPTIONS.map((opt) => {
            const active = draft.babyCount === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                onPress={() => set({ babyCount: opt.value })}
                style={{
                  flexBasis: '47%',
                  flexGrow: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.sm,
                  paddingVertical: t.spacing.md,
                  paddingHorizontal: t.spacing.lg,
                  borderRadius: t.radius.md,
                  borderWidth: 1.5,
                  borderColor: active ? t.colors.accent : t.colors.border,
                  backgroundColor: active ? t.colors.accentSoft : t.colors.surface,
                }}>
                <Ionicons name={opt.icon} size={18} color={active ? t.colors.accent : t.colors.textTertiary} />
                <AppText variant="body" color={active ? t.colors.accent : t.colors.text}>
                  {opt.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}
