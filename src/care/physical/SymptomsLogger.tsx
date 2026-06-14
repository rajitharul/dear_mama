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

import { addSymptom, deleteLog, listSymptoms, type CareLog, type SymptomData, type SymptomSeverity } from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, ChipSelect, DateField, Field, Pill } from '@/ui';

const SYMPTOM_OPTIONS = [
  'Nausea',
  'Morning sickness',
  'Aches & pains',
  'Discharge',
  'Fatigue',
  'Headache',
  'Swelling',
  'Heartburn',
  'Cramping',
  'Other',
];

const SEVERITY: { value: SymptomSeverity; label: string; tone: 'success' | 'accent' | 'danger' }[] = [
  { value: 'mild', label: 'Mild', tone: 'success' },
  { value: 'moderate', label: 'Moderate', tone: 'accent' },
  { value: 'severe', label: 'Severe', tone: 'danger' },
];
const severityMeta = (s: SymptomSeverity) => SEVERITY.find((x) => x.value === s)!;

/** Symptoms logger: a history list of symptoms + a form to add one with severity. */
export function SymptomsLogger({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [logs, setLogs] = useState<CareLog<SymptomData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      const fresh = await listSymptoms();
      setLogs(fresh);
      setStale(false);
    } catch {
      // Network/timeout: show the offline mirror instead of hanging.
      const cached = await loadLogCache<SymptomData>('symptom');
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

  function confirmDelete(log: CareLog<SymptomData>) {
    Alert.alert('Delete entry?', 'This will remove it from your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          try {
            await deleteLog(log.id, 'symptom');
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
      <AddSymptomForm
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
        <AppText variant="subtitle">Symptoms</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Log a symptom" icon="add" onPress={() => setMode('add')} />

        {stale ? (
          <Pill label="Showing saved entries — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : logs.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name="medical-outline" size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No symptoms logged
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              Tap “Log a symptom” to note anything you notice — ready to share with your care team.
            </AppText>
          </Card>
        ) : (
          logs.map((log, i) => {
            const sev = severityMeta(log.data.severity);
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
                      <Ionicons name="medkit-outline" size={22} color={t.colors.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="subtitle">{log.data.symptom}</AppText>
                      <AppText variant="caption">{format(new Date(log.loggedAt), 'd MMM yyyy · h:mm a')}</AppText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete entry"
                      hitSlop={10}
                      onPress={() => confirmDelete(log)}>
                      <Ionicons name="trash-outline" size={20} color={t.colors.textTertiary} />
                    </Pressable>
                  </View>
                  <View style={{ marginLeft: 44 + t.spacing.md, gap: t.spacing.sm }}>
                    <Pill label={sev.label} tone={sev.tone} icon="pulse-outline" />
                    {log.data.note ? <AppText variant="bodyMuted">{log.data.note}</AppText> : null}
                  </View>
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

function AddSymptomForm({
  userId,
  onCancel,
  onSaved,
}: {
  userId: string;
  onCancel: () => void;
  onSaved: (log: CareLog<SymptomData>) => void;
}) {
  const t = useTheme();
  const [symptom, setSymptom] = useState('Nausea');
  const [otherText, setOtherText] = useState('');
  const [severity, setSeverity] = useState<SymptomSeverity>('mild');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isOther = symptom === 'Other';

  async function save() {
    if (saving) return;
    const name = isOther ? otherText.trim() : symptom;
    if (!name) {
      setError('Please describe the symptom');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload: SymptomData = {
        kind: 'symptom',
        symptom: name,
        severity,
        note: note.trim() || undefined,
      };
      const log = await addSymptom(userId, payload, date);
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
          <AppText variant="subtitle">Log a symptom</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ChipSelect
            label="What are you noticing?"
            options={SYMPTOM_OPTIONS}
            value={[symptom]}
            onChange={(next) => {
              if (next[0]) {
                setSymptom(next[0]);
                setError('');
              }
            }}
          />

          <Card style={{ gap: t.spacing.lg }}>
            {isOther ? (
              <Field
                label="Describe the symptom"
                placeholder="e.g. Dizziness"
                value={otherText}
                onChangeText={setOtherText}
                error={error}
              />
            ) : null}

            <ChipSelect
              label="Severity"
              options={SEVERITY.map((s) => s.label)}
              value={[severityMeta(severity).label]}
              onChange={(next) => {
                const found = SEVERITY.find((s) => s.label === next[0]);
                if (found) setSeverity(found.value);
              }}
            />

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
          <Button label={saving ? 'Saving…' : 'Save symptom'} icon="checkmark" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
