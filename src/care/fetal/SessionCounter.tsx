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

import { deleteLog, type CareLog, type KickData, type LogType } from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, Field, Pill, PressableScale } from '@/ui';

/** The session counter is driven by a config so it can serve more than one countable thing. */
export type CounterData = KickData;

export type CounterConfig = {
  logType: Extract<LogType, 'kick'>;
  title: string; // list/header title, e.g. "Kick counter"
  sessionTitle: string; // session header, e.g. "Counting kicks"
  icon: keyof typeof Ionicons.glyphMap;
  nounOne: string; // "kick"
  nounMany: string; // "kicks"
  tapLabel: string; // button caption, e.g. "TAP FOR EACH KICK"
  startHelp: string; // guidance shown before reaching the goal
  reachedHelp: string; // guidance shown once the goal is reached
  emptyText: string; // empty-state copy
  goal: number; // gentle target (commonly 10)
  list: () => Promise<CareLog<CounterData>[]>;
  save: (
    userId: string,
    count: number,
    durationMin: number,
    note: string | undefined,
    loggedAt: Date,
  ) => Promise<CareLog<CounterData>>;
};

const pad = (n: number) => String(n).padStart(2, '0');
const formatClock = (sec: number) => `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
const formatDuration = (min: number) => (min < 1 ? `${Math.round(min * 60)}s` : `${Math.round(min)} min`);

/**
 * A live counting session screen (Fetal care): a history of sessions + a session where you
 * tap once for each kick / movement you feel. Each completed session is one care_logs entry.
 */
export function SessionCounter({
  userId,
  onBack,
  config,
}: {
  userId: string;
  onBack: () => void;
  config: CounterConfig;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'list' | 'session'>('list');
  const [logs, setLogs] = useState<CareLog<CounterData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const noun = (n: number) => (n === 1 ? config.nounOne : config.nounMany);

  const load = useCallback(async () => {
    try {
      const fresh = await config.list();
      setLogs(fresh);
      setStale(false);
    } catch {
      // Network/timeout: show the offline mirror instead of hanging.
      const cached = await loadLogCache<CounterData>(config.logType);
      setLogs(cached);
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    // load only sets state after awaited work, so the cascading-render rule doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function confirmDelete(log: CareLog<CounterData>) {
    Alert.alert('Delete session?', 'This will remove it from your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          try {
            await deleteLog(log.id, config.logType);
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
        config={config}
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
        <AppText variant="subtitle">{config.title}</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Start counting" icon={config.icon} onPress={() => setMode('session')} />

        {stale ? (
          <Pill label="Showing saved sessions — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : logs.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name={config.icon} size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No sessions yet
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              {config.emptyText}
            </AppText>
          </Card>
        ) : (
          logs.map((log, i) => (
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
                    <Ionicons name={config.icon} size={22} color={t.colors.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText variant="subtitle">
                      {log.data.count} {noun(log.data.count)}
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
                <View style={{ marginLeft: 44 + t.spacing.md, gap: t.spacing.sm }}>
                  <Pill
                    label={`Counted over ${formatDuration(log.data.durationMin)}`}
                    tone="neutral"
                    icon="time-outline"
                  />
                  {log.data.note ? <AppText variant="bodyMuted">{log.data.note}</AppText> : null}
                </View>
              </Card>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Session({
  userId,
  config,
  onCancel,
  onSaved,
}: {
  userId: string;
  config: CounterConfig;
  onCancel: () => void;
  onSaved: (log: CareLog<CounterData>) => void;
}) {
  const t = useTheme();
  const startRef = useRef(0);
  const [count, setCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Stamp the session start on mount (kept out of render to stay pure), then tick a 1s
    // elapsed clock derived from it so it stays accurate across re-renders.
    startRef.current = Date.now();
    const id = setInterval(() => setElapsedSec(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  function reset() {
    startRef.current = Date.now();
    setElapsedSec(0);
    setCount(0);
  }

  async function save() {
    if (saving || count < 1) return;
    setSaving(true);
    try {
      const log = await config.save(userId, count, +(elapsedSec / 60).toFixed(2), note.trim() || undefined, new Date(startRef.current));
      onSaved(log);
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', errorMessage(e));
    }
  }

  const reached = count >= config.goal;

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
          <AppText variant="subtitle">{config.sessionTitle}</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.spacing.lg }}>
            <Pill label={formatClock(elapsedSec)} tone="neutral" icon="time-outline" />
            <Pill
              label={reached ? `${count} ${config.nounMany} 🎉` : `${count} of ${config.goal}`}
              tone={reached ? 'success' : 'accent'}
              icon={config.icon}
            />
          </View>

          <View style={{ alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.md }}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Record a ${config.nounOne}`}
              onPress={() => setCount((c) => c + 1)}
              style={{
                width: 220,
                height: 220,
                borderRadius: 110,
                backgroundColor: t.colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                gap: t.spacing.xs,
                ...t.shadow.card,
              }}>
              <AppText variant="display" color={t.colors.accentOn} style={{ fontSize: 72, lineHeight: 80 }}>
                {count}
              </AppText>
              <AppText variant="label" color={t.colors.accentOn}>
                {config.tapLabel}
              </AppText>
            </PressableScale>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              {reached ? config.reachedHelp : config.startHelp}
            </AppText>
          </View>

          <Card style={{ gap: t.spacing.lg }}>
            <Field
              label="Note (optional)"
              placeholder="Anything you’d like to remember"
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Button label="Reset" variant="secondary" icon="refresh-outline" onPress={reset} disabled={count === 0} />
          </Card>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button
            label={saving ? 'Saving…' : 'Save session'}
            icon="checkmark"
            onPress={save}
            loading={saving}
            disabled={count < 1}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
