import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
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

import { addBabyNote, deleteLog, listBabyNotes, type BabyNoteData, type CareLog } from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, DateField, Field, Pill } from '@/ui';

/** A warm, relative day label: Today / Yesterday / 12 Jun 2026. */
function dayLabel(d: Date): string {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'd MMM yyyy');
}

/** Note to the baby: a journal of little daily notes + a form to write one. */
export function BabyNoteLogger({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [logs, setLogs] = useState<CareLog<BabyNoteData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    try {
      const fresh = await listBabyNotes();
      setLogs(fresh);
      setStale(false);
    } catch {
      // Network/timeout: show the offline mirror instead of hanging.
      const cached = await loadLogCache<BabyNoteData>('baby_note');
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

  function confirmDelete(log: CareLog<BabyNoteData>) {
    Alert.alert('Delete note?', 'This will remove it from your keepsake.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          try {
            await deleteLog(log.id, 'baby_note');
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
      <AddBabyNoteForm
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
        <AppText variant="subtitle">Note to the baby</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Write a note" icon="add" onPress={() => setMode('add')} />

        {stale ? (
          <Pill label="Showing saved notes — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : logs.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name="heart-outline" size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No notes yet
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              Tap “Write a note” to leave your little one a message — a keepsake to share with them one day.
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
                    <Ionicons name="heart" size={20} color={t.colors.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText variant="subtitle">{dayLabel(new Date(log.loggedAt))}</AppText>
                    <AppText variant="caption">{format(new Date(log.loggedAt), 'h:mm a')}</AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete note"
                    hitSlop={10}
                    onPress={() => confirmDelete(log)}>
                    <Ionicons name="trash-outline" size={20} color={t.colors.textTertiary} />
                  </Pressable>
                </View>
                <AppText variant="body" style={{ marginLeft: 44 + t.spacing.md }}>
                  {log.data.text}
                </AppText>
              </Card>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AddBabyNoteForm({
  userId,
  onCancel,
  onSaved,
}: {
  userId: string;
  onCancel: () => void;
  onSaved: (log: CareLog<BabyNoteData>) => void;
}) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    const note = text.trim();
    if (!note) {
      setError('Write a little something for your baby');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const log = await addBabyNote(userId, { kind: 'baby_note', text: note }, date);
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
          <AppText variant="subtitle">Write a note</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Card style={{ gap: t.spacing.lg }}>
            <DateField label="Day" mode="date" value={date} onChange={setDate} maximumDate={new Date()} />
            <Field
              label="Your note to baby"
              placeholder="Dear little one…"
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (error) setError('');
              }}
              error={error}
              multiline
            />
          </Card>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button label={saving ? 'Saving…' : 'Save note'} icon="checkmark" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
