import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Pressable, View } from 'react-native';

import type { ActionableFrequency, ActionableSchedule } from '@/care/api';
import { useTheme } from '@/theme';
import { AppText, ChipSelect, DateField } from '@/ui';

// Shared schedule editor for actionables — used both when adding/editing an actionable directly
// (ActionablesLogger) and when promoting a visit item to one (VisitsLogger). Keeping the chips,
// the active-period / deadline date rows, and the schedule (de)serialization in one place means
// the two entry points can't drift apart again.

type Freq = ActionableFrequency;

export const FREQS: Freq[] = ['daily', 'twice_daily', 'weekly', 'monthly', 'as_needed'];
export const FREQ_LABEL: Record<Freq, string> = {
  daily: 'Daily',
  twice_daily: 'Twice daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  as_needed: 'As needed',
};

export const COUNT_OPTIONS = ['Once', 'Twice', '3 times', '4 times', '5 times'];
export const countToLabel = (n: number) => COUNT_OPTIONS[Math.min(Math.max(n, 1), 5) - 1];
export const labelToCount = (l: string) => COUNT_OPTIONS.indexOf(l) + 1;

export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
// Parse a 'yyyy-MM-dd' as local midnight so day comparisons don't shift across the UTC boundary.
export const parseDay = (s: string) => new Date(`${s}T00:00:00`);

/** The editable shape behind a schedule: a flat draft whose dates are `Date | null` (vs the stored
 *  `'yyyy-MM-dd'` strings). Round-trips via `buildSchedule` / `splitSchedule`. */
export type ScheduleDraft = {
  kind: 'repeating' | 'finite';
  frequency: Freq;
  targetCount: number;
  startDate: Date | null;
  endDate: Date | null;
  deadline: Date | null;
};

export function emptyScheduleDraft(kind: ScheduleDraft['kind'] = 'repeating'): ScheduleDraft {
  return { kind, frequency: 'daily', targetCount: 1, startDate: null, endDate: null, deadline: null };
}

/** Draft → the persisted `ActionableSchedule` (optional dates only included when set). */
export function buildSchedule(draft: ScheduleDraft): ActionableSchedule {
  if (draft.kind === 'repeating') {
    return {
      type: 'repeating',
      frequency: draft.frequency,
      ...(draft.startDate ? { startDate: dayKey(draft.startDate) } : {}),
      ...(draft.endDate ? { endDate: dayKey(draft.endDate) } : {}),
    };
  }
  return { type: 'finite', targetCount: draft.targetCount, ...(draft.deadline ? { deadline: dayKey(draft.deadline) } : {}) };
}

/** Persisted schedule → an editable draft (the inverse of `buildSchedule`). */
export function splitSchedule(schedule: ActionableSchedule): ScheduleDraft {
  if (schedule.type === 'repeating') {
    return {
      kind: 'repeating',
      frequency: schedule.frequency,
      targetCount: 1,
      startDate: schedule.startDate ? parseDay(schedule.startDate) : null,
      endDate: schedule.endDate ? parseDay(schedule.endDate) : null,
      deadline: null,
    };
  }
  return {
    kind: 'finite',
    frequency: 'daily',
    targetCount: schedule.targetCount,
    startDate: null,
    endDate: null,
    deadline: schedule.deadline ? parseDay(schedule.deadline) : null,
  };
}

/** Returns an error message if the draft is inconsistent, else null. */
export function validateSchedule(draft: ScheduleDraft): string | null {
  if (draft.kind === 'repeating' && draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
    return 'The end date can’t be before the start date.';
  }
  return null;
}

function OptionalDateRow({
  addLabel,
  fieldLabel,
  value,
  set,
  minimumDate,
}: {
  addLabel: string;
  fieldLabel: string;
  value: Date | null;
  set: (d: Date | null) => void;
  minimumDate?: Date;
}) {
  const t = useTheme();
  if (!value) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        onPress={() => set(minimumDate && minimumDate > new Date() ? minimumDate : new Date())}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          paddingVertical: t.spacing.sm,
        }}>
        <Ionicons name="add-circle-outline" size={20} color={t.colors.accent} />
        <AppText variant="body" color={t.colors.accent}>
          {addLabel}
        </AppText>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: t.spacing.xs }}>
      <DateField label={fieldLabel} value={value} onChange={set} minimumDate={minimumDate} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${fieldLabel}`} onPress={() => set(null)}>
        <AppText variant="caption" color={t.colors.textSecondary}>
          Clear
        </AppText>
      </Pressable>
    </View>
  );
}

/** The full schedule editor: type (Repeating / One-off), cadence/count, and the optional active
 *  period (repeating) or deadline (finite). Controlled via a `ScheduleDraft` + `onChange`. */
export function ScheduleFields({
  draft,
  onChange,
}: {
  draft: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
}) {
  const t = useTheme();
  const patch = (next: Partial<ScheduleDraft>) => onChange({ ...draft, ...next });

  return (
    <>
      <ChipSelect
        label="Schedule"
        options={['Repeating', 'One-off']}
        value={[draft.kind === 'repeating' ? 'Repeating' : 'One-off']}
        onChange={(next) => {
          if (next[0]) patch({ kind: next[0] === 'One-off' ? 'finite' : 'repeating' });
        }}
        hint={
          draft.kind === 'repeating'
            ? 'Recurs on a cadence — optionally only between two dates.'
            : 'A fixed number of times, optionally by a deadline.'
        }
      />

      {draft.kind === 'repeating' ? (
        <>
          <ChipSelect
            label="How often?"
            options={FREQS.map((f) => FREQ_LABEL[f])}
            value={[FREQ_LABEL[draft.frequency]]}
            onChange={(next) => {
              const found = FREQS.find((f) => FREQ_LABEL[f] === next[0]);
              if (found) patch({ frequency: found });
            }}
          />
          <View style={{ gap: t.spacing.sm }}>
            <AppText variant="label">ACTIVE PERIOD (OPTIONAL)</AppText>
            <OptionalDateRow
              addLabel="Add a start date"
              fieldLabel="Start date"
              value={draft.startDate}
              set={(d) => patch({ startDate: d })}
            />
            <OptionalDateRow
              addLabel="Add an end date"
              fieldLabel="End date"
              value={draft.endDate}
              set={(d) => patch({ endDate: d })}
              minimumDate={draft.startDate ?? undefined}
            />
          </View>
        </>
      ) : (
        <>
          <ChipSelect
            label="How many times?"
            options={COUNT_OPTIONS}
            value={[countToLabel(draft.targetCount)]}
            onChange={(next) => {
              const n = labelToCount(next[0] ?? '');
              if (n > 0) patch({ targetCount: n });
            }}
          />
          <View style={{ gap: t.spacing.sm }}>
            <AppText variant="label">DEADLINE (OPTIONAL)</AppText>
            <OptionalDateRow
              addLabel="Add a deadline"
              fieldLabel="Deadline"
              value={draft.deadline}
              set={(d) => patch({ deadline: d })}
            />
          </View>
        </>
      )}
    </>
  );
}
