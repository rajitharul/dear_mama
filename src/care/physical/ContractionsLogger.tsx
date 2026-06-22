import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  addContraction,
  deleteLog,
  listContractions,
  type CareLog,
  type ContractionData,
  type ContractionEntry,
  type ContractionType,
} from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, ChipSelect, Field, Pill, PressableScale } from '@/ui';

const pad = (n: number) => String(n).padStart(2, '0');
const formatClock = (sec: number) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
// Human-friendly length/gap: seconds under a minute, else "Xm" / "Xm Ys".
const formatSecs = (sec: number) => {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
};

const TYPE_OPTIONS: { type: ContractionType; label: string; short: string }[] = [
  { type: 'braxton_hicks', label: 'Braxton Hicks (practice)', short: 'Braxton Hicks' },
  { type: 'labor', label: 'Labor', short: 'Labor' },
];

/** Mean duration + mean gap between consecutive starts (0 if fewer than 2 entries). */
function summarize(entries: ContractionEntry[]): { count: number; avgDurationSec: number; avgIntervalSec: number } {
  const count = entries.length;
  const avgDurationSec = count ? Math.round(entries.reduce((s, e) => s + e.durationSec, 0) / count) : 0;
  let avgIntervalSec = 0;
  if (count >= 2) {
    let total = 0;
    for (let i = 1; i < count; i++) {
      total += (Date.parse(entries[i].startedAt) - Date.parse(entries[i - 1].startedAt)) / 1000;
    }
    avgIntervalSec = Math.round(total / (count - 1));
  }
  return { count, avgDurationSec, avgIntervalSec };
}

/**
 * Contractions logger (Physical care): a history of timing sessions + a live session where you
 * start/stop each contraction. Each completed session is one care_logs entry. The interval between
 * starts (frequency) is derived; regular vs irregular intervals tell labor from Braxton Hicks.
 */
export function ContractionsLogger({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'list' | 'session'>('list');
  const [logs, setLogs] = useState<CareLog<ContractionData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      const fresh = await listContractions();
      setLogs(fresh);
      setStale(false);
    } catch {
      // Network/timeout: show the offline mirror instead of hanging.
      const cached = await loadLogCache<ContractionData>('contraction');
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

  function confirmDelete(log: CareLog<ContractionData>) {
    Alert.alert('Delete session?', 'This will remove it from your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          try {
            await deleteLog(log.id, 'contraction');
          } catch (e) {
            setLogs(prev); // revert
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (mode === 'session') {
    return (
      <Session
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
        <AppText variant="subtitle">Contractions</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Start timing" icon="stopwatch-outline" onPress={() => setMode('session')} />

        {stale ? (
          <Pill label="Showing saved sessions — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : logs.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name="stopwatch-outline" size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No sessions yet
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              Tap “Start timing” and start a contraction when one begins, stop it when it eases. We’ll
              note how long each lasts and how far apart they come.
            </AppText>
          </Card>
        ) : (
          logs.map((log, i) => {
            const d = log.data;
            const typeLabel = TYPE_OPTIONS.find((o) => o.type === d.type)?.short;
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
                      <Ionicons name="stopwatch-outline" size={22} color={t.colors.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="subtitle">
                        {d.count} {d.count === 1 ? 'contraction' : 'contractions'}
                      </AppText>
                      <AppText variant="caption">{format(new Date(log.loggedAt), 'd MMM yyyy · h:mm a')}</AppText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete session"
                      hitSlop={10}
                      onPress={() => confirmDelete(log)}>
                      <Ionicons name="trash-outline" size={20} color={t.colors.textTertiary} />
                    </Pressable>
                  </View>
                  <View style={{ marginLeft: 44 + t.spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                    {typeLabel ? (
                      <Pill label={typeLabel} tone={d.type === 'labor' ? 'accent' : 'neutral'} icon="pulse-outline" />
                    ) : null}
                    <Pill label={`~${formatSecs(d.avgDurationSec)} long`} tone="neutral" icon="time-outline" />
                    {d.avgIntervalSec > 0 ? (
                      <Pill label={`~${formatSecs(d.avgIntervalSec)} apart`} tone="neutral" icon="repeat-outline" />
                    ) : null}
                  </View>
                  {d.note ? (
                    <AppText variant="bodyMuted" style={{ marginLeft: 44 + t.spacing.md }}>
                      {d.note}
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

function Session({
  userId,
  onCancel,
  onSaved,
}: {
  userId: string;
  onCancel: () => void;
  onSaved: (log: CareLog<ContractionData>) => void;
}) {
  const t = useTheme();
  const activeStartRef = useRef<number | null>(null); // start of the in-progress contraction (ms), or null when idle
  const [active, setActive] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [entries, setEntries] = useState<ContractionEntry[]>([]);
  const [sessionType, setSessionType] = useState<ContractionType | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Tick a 1s clock derived from the active contraction's start (kept in a ref, set in handlers).
    const id = setInterval(() => {
      if (activeStartRef.current != null) {
        setElapsedSec(Math.floor((Date.now() - activeStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function toggle() {
    if (active) {
      const start = activeStartRef.current;
      if (start != null) {
        const durationSec = Math.max(1, Math.round((Date.now() - start) / 1000));
        setEntries((e) => [...e, { startedAt: new Date(start).toISOString(), durationSec }]);
      }
      activeStartRef.current = null;
      setActive(false);
      setElapsedSec(0);
    } else {
      activeStartRef.current = Date.now();
      setActive(true);
      setElapsedSec(0);
    }
  }

  function reset() {
    activeStartRef.current = null;
    setActive(false);
    setElapsedSec(0);
    setEntries([]);
  }

  async function save() {
    if (saving || entries.length < 1) return;
    setSaving(true);
    const { count, avgDurationSec, avgIntervalSec } = summarize(entries);
    const sessionStart = entries[0] ? new Date(entries[0].startedAt) : new Date();
    const payload: ContractionData = {
      kind: 'contraction',
      ...(sessionType ? { type: sessionType } : {}),
      entries,
      count,
      avgDurationSec,
      avgIntervalSec,
      note: note.trim() || undefined,
    };
    try {
      const log = await addContraction(userId, payload, sessionStart);
      onSaved(log);
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', errorMessage(e));
    }
  }

  const live = summarize(entries);

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
          <AppText variant="subtitle">Timing contractions</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: t.spacing.sm }}>
            <Pill label={`${live.count} so far`} tone="accent" icon="stopwatch-outline" />
            {live.avgDurationSec > 0 ? (
              <Pill label={`~${formatSecs(live.avgDurationSec)} long`} tone="neutral" icon="time-outline" />
            ) : null}
            {live.avgIntervalSec > 0 ? (
              <Pill label={`~${formatSecs(live.avgIntervalSec)} apart`} tone="neutral" icon="repeat-outline" />
            ) : null}
          </View>

          <View style={{ alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.md }}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={active ? 'Stop this contraction' : 'Start a contraction'}
              onPress={toggle}
              style={{
                width: 220,
                height: 220,
                borderRadius: 110,
                backgroundColor: active ? t.colors.danger : t.colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                gap: t.spacing.xs,
                ...t.shadow.card,
              }}>
              <AppText variant="display" color={t.colors.accentOn} style={{ fontSize: 56, lineHeight: 64 }}>
                {active ? formatClock(elapsedSec) : '⏱'}
              </AppText>
              <AppText variant="label" color={t.colors.accentOn}>
                {active ? 'STOP CONTRACTION' : 'START CONTRACTION'}
              </AppText>
            </PressableScale>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              {active
                ? 'Tap stop when this contraction eases off.'
                : 'Tap start when a contraction begins. Time a few and the rhythm will show.'}
            </AppText>
          </View>

          {entries.length ? (
            <Card style={{ gap: t.spacing.sm }}>
              <AppText variant="label">THIS SESSION</AppText>
              {entries.map((e, i) => {
                const intervalSec =
                  i > 0 ? Math.round((Date.parse(e.startedAt) - Date.parse(entries[i - 1].startedAt)) / 1000) : null;
                return (
                  <View
                    key={e.startedAt}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                    <AppText variant="body" color={t.colors.textTertiary} style={{ width: 24 }}>
                      {i + 1}
                    </AppText>
                    <AppText variant="body" style={{ flex: 1 }}>
                      {formatSecs(e.durationSec)} long
                    </AppText>
                    <AppText variant="caption">
                      {intervalSec != null ? `${formatSecs(intervalSec)} apart` : format(new Date(e.startedAt), 'h:mm a')}
                    </AppText>
                  </View>
                );
              })}
            </Card>
          ) : null}

          <Card style={{ gap: t.spacing.lg }}>
            <ChipSelect
              label="Type (optional)"
              options={TYPE_OPTIONS.map((o) => o.label)}
              value={sessionType ? [TYPE_OPTIONS.find((o) => o.type === sessionType)!.label] : []}
              onChange={(next) => {
                const found = TYPE_OPTIONS.find((o) => o.label === next[0]);
                setSessionType(found ? found.type : null);
              }}
            />
            <Field
              label="Note (optional)"
              placeholder="Anything you’d like to remember"
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Button
              label="Reset"
              variant="secondary"
              icon="refresh-outline"
              onPress={reset}
              disabled={!active && entries.length === 0}
            />
          </Card>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button
            label={saving ? 'Saving…' : 'Save session'}
            icon="checkmark"
            onPress={save}
            loading={saving}
            disabled={entries.length < 1}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
