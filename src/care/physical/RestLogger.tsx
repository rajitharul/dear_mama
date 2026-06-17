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

import { addRest, deleteLog, listRest, type CareLog, type RestData, type RestQuality } from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, ChipSelect, DateField, Field, Pill } from '@/ui';

const QUALITY: { value: RestQuality; label: string; tone: 'success' | 'neutral' | 'danger' }[] = [
  { value: 'restful', label: 'Restful', tone: 'success' },
  { value: 'okay', label: 'Okay', tone: 'neutral' },
  { value: 'restless', label: 'Restless', tone: 'danger' },
];
const qualityMeta = (q: RestQuality) => QUALITY.find((x) => x.value === q)!;
const formatHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? 'hour' : 'hours'}`;

/**
 * Rest & sleep logger: a history list of nights + a form to add one with quality.
 * FUTURE: when the user grants access, sleep hours can be pulled automatically from
 * Apple Health (HealthKit) / Google Health (Health Connect); manual entry stays as the
 * fallback for when a health source isn't available or connected.
 */
export function RestLogger({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [logs, setLogs] = useState<CareLog<RestData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      const fresh = await listRest();
      setLogs(fresh);
      setStale(false);
    } catch {
      // Network/timeout: show the offline mirror instead of hanging.
      const cached = await loadLogCache<RestData>('rest');
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

  function confirmDelete(log: CareLog<RestData>) {
    Alert.alert('Delete entry?', 'This will remove it from your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          try {
            await deleteLog(log.id, 'rest');
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
      <AddRestForm
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
        <AppText variant="subtitle">Rest & sleep</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Log your sleep" icon="add" onPress={() => setMode('add')} />

        {stale ? (
          <Pill label="Showing saved entries — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : logs.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name="moon-outline" size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No sleep logged
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              Tap “Log your sleep” to note how you rested — gentle trends to share with your care team.
            </AppText>
          </Card>
        ) : (
          logs.map((log, i) => {
            const q = qualityMeta(log.data.quality);
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
                      <Ionicons name="moon-outline" size={22} color={t.colors.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="subtitle">{formatHours(log.data.hours)}</AppText>
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
                    <Pill label={q.label} tone={q.tone} icon="bed-outline" />
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

function AddRestForm({
  userId,
  onCancel,
  onSaved,
}: {
  userId: string;
  onCancel: () => void;
  onSaved: (log: CareLog<RestData>) => void;
}) {
  const t = useTheme();
  const [hours, setHours] = useState('');
  const [quality, setQuality] = useState<RestQuality>('okay');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    const value = parseFloat(hours.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0 || value > 24) {
      setError('Enter hours of sleep between 0 and 24');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload: RestData = {
        kind: 'rest',
        hours: value,
        quality,
        note: note.trim() || undefined,
      };
      const log = await addRest(userId, payload, date);
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
          <AppText variant="subtitle">Log your sleep</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Card style={{ gap: t.spacing.lg }}>
            <Field
              label="Hours slept"
              placeholder="e.g. 7.5"
              keyboardType="decimal-pad"
              hint="Soon you’ll be able to sync this from Apple Health or Google Health"
              value={hours}
              onChangeText={(v) => {
                setHours(v);
                if (error) setError('');
              }}
              error={error}
            />

            <ChipSelect
              label="How rested do you feel?"
              options={QUALITY.map((q) => q.label)}
              value={[qualityMeta(quality).label]}
              onChange={(next) => {
                const found = QUALITY.find((q) => q.label === next[0]);
                if (found) setQuality(found.value);
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
          <Button label={saving ? 'Saving…' : 'Save sleep'} icon="checkmark" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
