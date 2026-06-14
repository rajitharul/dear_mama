import type { StepProps } from '@/onboarding/types';
import { ChipListInput, Field } from '@/ui';

export function MedicalStep({ draft, set }: StepProps) {
  return (
    <>
      <Field
        label="Blood type"
        placeholder="e.g. O+"
        autoCapitalize="characters"
        value={draft.bloodType}
        onChangeText={(bloodType) => set({ bloodType })}
      />
      <ChipListInput
        label="Pre-existing conditions"
        placeholder="e.g. Hypothyroidism"
        value={draft.conditions}
        onChange={(conditions) => set({ conditions })}
      />
      <ChipListInput
        label="Allergies"
        placeholder="e.g. Penicillin"
        value={draft.allergies}
        onChange={(allergies) => set({ allergies })}
      />
      <ChipListInput
        label="Current medications & supplements"
        placeholder="e.g. Folic acid"
        value={draft.medications}
        onChange={(medications) => set({ medications })}
      />
      <Field
        label="Prior pregnancies"
        placeholder="e.g. 1"
        keyboardType="number-pad"
        value={draft.priorPregnancies}
        onChangeText={(v) => set({ priorPregnancies: v.replace(/[^0-9]/g, '') })}
      />
      <Field
        label="Anything else to note?"
        placeholder="Notes for yourself or your doctor"
        multiline
        value={draft.medicalNotes}
        onChangeText={(medicalNotes) => set({ medicalNotes })}
      />
    </>
  );
}
