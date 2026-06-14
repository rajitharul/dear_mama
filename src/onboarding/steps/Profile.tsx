import type { StepProps } from '@/onboarding/types';
import { Field } from '@/ui';

export function ProfileStep({ draft, set }: StepProps) {
  return (
    <>
      <Field
        label="Your name"
        placeholder="e.g. Maya"
        value={draft.displayName}
        onChangeText={(displayName) => set({ displayName })}
      />
      <Field
        label="Your age (optional)"
        placeholder="e.g. 30"
        keyboardType="number-pad"
        value={draft.age}
        onChangeText={(age) => set({ age: age.replace(/[^0-9]/g, '') })}
      />
    </>
  );
}
