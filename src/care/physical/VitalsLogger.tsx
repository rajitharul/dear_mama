import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addVital,
  deleteLog,
  listVitals,
  type CareLog,
  type ExerciseIntensity,
  type GlucoseContext,
  type GlucoseUnit,
  type MealKind,
  type VitalData,
  type VitalKind,
  type WeightUnit,
} from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, ChipSelect, DateField, Field, Pill } from '@/ui';

const CONTEXT_LABEL: Record<GlucoseContext, string> = {
  fasting: 'Fasting',
  post_meal: 'Post-meal',
  random: 'Random',
};

const MEAL_LABEL: Record<MealKind, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const INTENSITY_LABEL: Record<ExerciseIntensity, string> = {
  light: 'Light',
  moderate: 'Moderate',
  intense: 'Intense',
};

function summarize(d: VitalData): { icon: keyof typeof Ionicons.glyphMap; title: string; value: string } {
  switch (d.kind) {
    case 'bp':
      return {
        icon: 'heart-outline',
        title: 'Blood pressure',
        value: `${d.systolic}/${d.diastolic} mmHg${d.pulse ? ` · ${d.pulse} bpm` : ''}`,
      };
    case 'weight':
      return { icon: 'barbell-outline', title: 'Weight', value: `${d.value} ${d.unit}` };
    case 'blood_sugar':
      return {
        icon: 'water-outline',
        title: 'Blood sugar',
        value: `${d.value} ${d.unit} · ${CONTEXT_LABEL[d.context]}`,
      };
    case 'water':
      return {
        icon: 'cafe-outline',
        title: 'Water',
        value: `${d.glasses} ${d.glasses === 1 ? 'glass' : 'glasses'}`,
      };
    case 'food':
      return { icon: 'restaurant-outline', title: MEAL_LABEL[d.meal], value: d.description };
    case 'exercise':
      return {
        icon: 'walk-outline',
        title: 'Exercise',
        value: `${d.activity} · ${d.durationMin} min${d.intensity ? ` · ${INTENSITY_LABEL[d.intensity]}` : ''}`,
      };
  }
}

/** Vitals logger: a history list of readings + a form to add blood pressure, weight, or blood sugar. */
export function VitalsLogger({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [logs, setLogs] = useState<CareLog<VitalData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      const fresh = await listVitals();
      setLogs(fresh);
      setStale(false);
    } catch {
      // Network/timeout: show the offline mirror instead of hanging.
      const cached = await loadLogCache<VitalData>('vital');
      setLogs(cached);
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load only sets state after awaited work, so the cascading-render rule doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function confirmDelete(log: CareLog<VitalData>) {
    Alert.alert('Delete reading?', 'This will remove it from your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          try {
            await deleteLog(log.id, 'vital');
          } catch (e) {
            setLogs(prev); // revert
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (mode === 'add') {
    return (
      <AddVitalForm
        userId={userId}
        onCancel={() => setMode('list')}
        onSaved={(log) => {
          setLogs((l) => [log, ...l]);
          setMode('list');
        }}
      />
    );
  }

  const entering = (delay: number) => (reduce ? undefined : calmRise(delay));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
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
        <AppText variant="subtitle">Vitals</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Log a reading" icon="add" onPress={() => setMode('add')} />

        {stale ? (
          <Pill label="Showing saved readings — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : logs.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name="pulse-outline" size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No readings yet
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              Tap “Log a reading” to record your blood pressure, weight, blood sugar, water, food or exercise.
            </AppText>
          </Card>
        ) : (
          logs.map((log, i) => {
            const s = summarize(log.data);
            return (
              <Animated.View key={log.id} entering={entering(i * 50)}>
                <Card style={{ gap: t.spacing.sm }}>
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
                      <Ionicons name={s.icon} size={22} color={t.colors.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="subtitle">{s.value}</AppText>
                      <AppText variant="caption">
                        {s.title} · {format(new Date(log.loggedAt), 'd MMM yyyy · h:mm a')}
                      </AppText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete reading"
                      hitSlop={10}
                      onPress={() => confirmDelete(log)}>
                      <Ionicons name="trash-outline" size={20} color={t.colors.textTertiary} />
                    </Pressable>
                  </View>
                  {log.data.note ? (
                    <AppText variant="bodyMuted" style={{ marginLeft: 44 + t.spacing.md }}>
                      {log.data.note}
                    </AppText>
                  ) : null}
                </Card>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const KIND_OPTIONS: { kind: VitalKind; label: string }[] = [
  { kind: 'bp', label: 'Blood pressure' },
  { kind: 'weight', label: 'Weight' },
  { kind: 'blood_sugar', label: 'Blood sugar' },
  { kind: 'water', label: 'Water' },
  { kind: 'food', label: 'Food' },
  { kind: 'exercise', label: 'Exercise' },
];
const WEIGHT_UNITS: WeightUnit[] = ['kg', 'lb'];
const GLUCOSE_UNITS: GlucoseUnit[] = ['mmol/L', 'mg/dL'];
const GLUCOSE_CONTEXTS: GlucoseContext[] = ['fasting', 'post_meal', 'random'];
const MEAL_KINDS: MealKind[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const EXERCISE_INTENSITIES: ExerciseIntensity[] = ['light', 'moderate', 'intense'];

const num = (s: string): number | null => {
  const n = parseFloat(s.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

function AddVitalForm({
  userId,
  onCancel,
  onSaved,
}: {
  userId: string;
  onCancel: () => void;
  onSaved: (log: CareLog<VitalData>) => void;
}) {
  const t = useTheme();
  const [kind, setKind] = useState<VitalKind>('bp');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [glucose, setGlucose] = useState('');
  const [glucoseUnit, setGlucoseUnit] = useState<GlucoseUnit>('mmol/L');
  const [context, setContext] = useState<GlucoseContext>('fasting');
  const [glasses, setGlasses] = useState(1);
  const [meal, setMeal] = useState<MealKind>('breakfast');
  const [foodDesc, setFoodDesc] = useState('');
  const [activity, setActivity] = useState('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState<ExerciseIntensity>('moderate');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function buildPayload(): VitalData | null {
    const next: Record<string, string> = {};
    const trimmedNote = note.trim() || undefined;
    let payload: VitalData | null = null;

    if (kind === 'bp') {
      const sys = num(systolic);
      const dia = num(diastolic);
      if (!sys) next.systolic = 'Enter a number';
      if (!dia) next.diastolic = 'Enter a number';
      if (sys && dia) {
        const p = pulse.trim() ? num(pulse) : undefined;
        payload = { kind: 'bp', systolic: sys, diastolic: dia, ...(p ? { pulse: p } : {}), note: trimmedNote };
      }
    } else if (kind === 'weight') {
      const v = num(weight);
      if (!v) next.weight = 'Enter a number';
      else payload = { kind: 'weight', value: v, unit: weightUnit, note: trimmedNote };
    } else if (kind === 'blood_sugar') {
      const v = num(glucose);
      if (!v) next.glucose = 'Enter a number';
      else payload = { kind: 'blood_sugar', value: v, unit: glucoseUnit, context, note: trimmedNote };
    } else if (kind === 'water') {
      payload = { kind: 'water', glasses, note: trimmedNote };
    } else if (kind === 'food') {
      const desc = foodDesc.trim();
      if (!desc) next.foodDesc = 'What did you eat?';
      else payload = { kind: 'food', meal, description: desc, note: trimmedNote };
    } else {
      const act = activity.trim();
      const mins = num(duration);
      if (!act) next.activity = 'Name the activity';
      if (!mins) next.duration = 'Enter minutes';
      if (act && mins) payload = { kind: 'exercise', activity: act, durationMin: mins, intensity, note: trimmedNote };
    }

    setErrors(next);
    return payload;
  }

  async function save() {
    if (saving) return;
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    try {
      const log = await addVital(userId, payload, date);
      onSaved(log);
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', errorMessage(e));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
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
          <AppText variant="subtitle">Log a reading</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ChipSelect
            label="What are you logging?"
            options={KIND_OPTIONS.map((o) => o.label)}
            value={[KIND_OPTIONS.find((o) => o.kind === kind)!.label]}
            onChange={(next) => {
              const found = KIND_OPTIONS.find((o) => o.label === next[0]);
              if (found) {
                setKind(found.kind);
                setErrors({});
              }
            }}
          />

          <Card style={{ gap: t.spacing.lg }}>
            {kind === 'bp' ? (
              <>
                <Field
                  label="Systolic (top)"
                  placeholder="e.g. 120"
                  keyboardType="number-pad"
                  value={systolic}
                  onChangeText={setSystolic}
                  error={errors.systolic}
                />
                <Field
                  label="Diastolic (bottom)"
                  placeholder="e.g. 80"
                  keyboardType="number-pad"
                  value={diastolic}
                  onChangeText={setDiastolic}
                  error={errors.diastolic}
                />
                <Field
                  label="Pulse (optional)"
                  placeholder="e.g. 72 bpm"
                  keyboardType="number-pad"
                  value={pulse}
                  onChangeText={setPulse}
                />
              </>
            ) : null}

            {kind === 'weight' ? (
              <>
                <Field
                  label="Weight"
                  placeholder="e.g. 62"
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                  error={errors.weight}
                />
                <ChipSelect
                  label="Unit"
                  options={WEIGHT_UNITS}
                  value={[weightUnit]}
                  onChange={(n) => n[0] && setWeightUnit(n[0] as WeightUnit)}
                />
              </>
            ) : null}

            {kind === 'blood_sugar' ? (
              <>
                <Field
                  label="Blood sugar"
                  placeholder="e.g. 5.4"
                  keyboardType="decimal-pad"
                  value={glucose}
                  onChangeText={setGlucose}
                  error={errors.glucose}
                />
                <ChipSelect
                  label="Unit"
                  options={GLUCOSE_UNITS}
                  value={[glucoseUnit]}
                  onChange={(n) => n[0] && setGlucoseUnit(n[0] as GlucoseUnit)}
                />
                <ChipSelect
                  label="When"
                  options={GLUCOSE_CONTEXTS.map((c) => CONTEXT_LABEL[c])}
                  value={[CONTEXT_LABEL[context]]}
                  onChange={(n) => {
                    const found = GLUCOSE_CONTEXTS.find((c) => CONTEXT_LABEL[c] === n[0]);
                    if (found) setContext(found);
                  }}
                />
              </>
            ) : null}

            {kind === 'water' ? (
              <View style={{ gap: t.spacing.sm }}>
                <AppText variant="label">HOW MANY GLASSES?</AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.spacing.xl }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="One fewer glass"
                    hitSlop={10}
                    disabled={glasses <= 1}
                    onPress={() => setGlasses((g) => Math.max(1, g - 1))}>
                    <Ionicons
                      name="remove-circle-outline"
                      size={40}
                      color={glasses <= 1 ? t.colors.border : t.colors.accent}
                    />
                  </Pressable>
                  <View style={{ alignItems: 'center', minWidth: 64 }}>
                    <AppText variant="display">{glasses}</AppText>
                    <AppText variant="caption">{glasses === 1 ? 'glass' : 'glasses'}</AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="One more glass"
                    hitSlop={10}
                    onPress={() => setGlasses((g) => g + 1)}>
                    <Ionicons name="add-circle-outline" size={40} color={t.colors.accent} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {kind === 'food' ? (
              <>
                <ChipSelect
                  label="Meal"
                  options={MEAL_KINDS.map((m) => MEAL_LABEL[m])}
                  value={[MEAL_LABEL[meal]]}
                  onChange={(n) => {
                    const found = MEAL_KINDS.find((m) => MEAL_LABEL[m] === n[0]);
                    if (found) setMeal(found);
                  }}
                />
                <Field
                  label="What did you eat?"
                  placeholder="e.g. Oats with berries and yoghurt"
                  value={foodDesc}
                  onChangeText={setFoodDesc}
                  error={errors.foodDesc}
                  multiline
                />
              </>
            ) : null}

            {kind === 'exercise' ? (
              <>
                <Field
                  label="Activity"
                  placeholder="e.g. Walk, prenatal yoga, swimming"
                  value={activity}
                  onChangeText={setActivity}
                  error={errors.activity}
                />
                <Field
                  label="Duration (minutes)"
                  placeholder="e.g. 30"
                  keyboardType="number-pad"
                  value={duration}
                  onChangeText={setDuration}
                  error={errors.duration}
                />
                <ChipSelect
                  label="Intensity (optional)"
                  options={EXERCISE_INTENSITIES.map((x) => INTENSITY_LABEL[x])}
                  value={[INTENSITY_LABEL[intensity]]}
                  onChange={(n) => {
                    const found = EXERCISE_INTENSITIES.find((x) => INTENSITY_LABEL[x] === n[0]);
                    if (found) setIntensity(found);
                  }}
                />
              </>
            ) : null}

            <DateField label="Date & time" mode="datetime" value={date} onChange={setDate} maximumDate={new Date()} />
            <Field
              label="Note (optional)"
              placeholder="Anything you’d like to remember"
              value={note}
              onChangeText={setNote}
              multiline
            />
          </Card>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button label={saving ? 'Saving…' : 'Save reading'} icon="checkmark" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
