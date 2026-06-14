import { format } from 'date-fns';
import { View } from 'react-native';

import { babyCountLabel, dateSourceLabel } from '@/onboarding/labels';
import type { StepProps } from '@/onboarding/types';
import { eddFromLmp, formatGestationalAge, gestationalAge } from '@/pregnancy/weekMath';
import { useTheme } from '@/theme';
import { AppText, Card } from '@/ui';

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.lg }}>
      <AppText variant="bodyMuted">{label}</AppText>
      <AppText variant="body" weight="semibold" style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
}

export function ReviewStep({ draft }: StepProps) {
  const t = useTheme();
  const chosen = draft.date ? new Date(draft.date) : null;
  const edd = chosen ? (draft.dateMode === 'edd' ? chosen : eddFromLmp(chosen)) : null;
  const ga = edd ? gestationalAge(edd) : null;

  const hasMedical =
    draft.bloodType || draft.conditions.length || draft.allergies.length || draft.medications.length;
  const hasContacts = draft.emergencyName || draft.careName;

  return (
    <>
      <Card style={{ gap: t.spacing.md }}>
        <Row label="Name" value={draft.displayName.trim() || 'Mama'} />
        {draft.age ? <Row label="Age" value={draft.age} /> : null}
        {edd ? <Row label="Due date" value={format(edd, 'd MMM yyyy')} /> : null}
        {dateSourceLabel(draft.dateSource) ? (
          <Row
            label="Due date source"
            value={
              draft.dateSource === 'doctor' && draft.dueDateDoctor.trim()
                ? `${dateSourceLabel(draft.dateSource)} · ${draft.dueDateDoctor.trim()}`
                : dateSourceLabel(draft.dateSource)!
            }
          />
        ) : null}
        {ga ? <Row label="Right now" value={`${formatGestationalAge(ga)} · ${ga.weeksToGo}w to go`} /> : null}
        <Row label="Babies" value={babyCountLabel(draft.babyCount)} />
      </Card>

      {hasMedical ? (
        <Card style={{ gap: t.spacing.md }}>
          <AppText variant="label">MEDICAL</AppText>
          {draft.bloodType ? <Row label="Blood type" value={draft.bloodType} /> : null}
          {draft.conditions.length ? <Row label="Conditions" value={draft.conditions.join(', ')} /> : null}
          {draft.allergies.length ? <Row label="Allergies" value={draft.allergies.join(', ')} /> : null}
          {draft.medications.length ? <Row label="Medications" value={draft.medications.join(', ')} /> : null}
        </Card>
      ) : null}

      {hasContacts ? (
        <Card style={{ gap: t.spacing.md }}>
          <AppText variant="label">CONTACTS</AppText>
          {draft.emergencyName ? (
            <Row
              label="Emergency"
              value={`${draft.emergencyName}${draft.emergencyPhone ? ` · ${draft.emergencyPhone}` : ''}`}
            />
          ) : null}
          {draft.careName ? <Row label="Provider" value={draft.careName} /> : null}
        </Card>
      ) : null}

      <AppText variant="caption" center>
        You can edit any of this later from Home.
      </AppText>
    </>
  );
}
