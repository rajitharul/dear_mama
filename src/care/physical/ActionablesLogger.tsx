import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, subDays, subMonths, subWeeks } from 'date-fns';
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
  addActionableCheck,
  addActionableItem,
  deleteLog,
  listActionables,
  updateActionableItem,
  type ActionableCheckData,
  type ActionableData,
  type ActionableFrequency,
  type ActionableItemData,
  type ActionableSchedule,
  type CareLog,
} from '@/care/api';
import { loadLogCache } from '@/care/cache';
import {
  buildSchedule,
  dayKey,
  emptyScheduleDraft,
  FREQ_LABEL,
  parseDay,
  ScheduleFields,
  splitSchedule,
  validateSchedule,
  type ScheduleDraft,
} from '@/care/physical/scheduleFields';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, Field, Pill } from '@/ui';

type Freq = ActionableFrequency;
type Item = { id: string; label: string; instruction?: string; schedule: ActionableSchedule; loggedAt: string };
type CheckLog = CareLog<ActionableCheckData>;
type Status = 'active' | 'upcoming' | 'ended' | 'overdue';

// How many completions a single period needs (0 = no required cadence).
const TARGET: Record<Freq, number> = { daily: 1, twice_daily: 2, weekly: 1, monthly: 1, as_needed: 0 };
const STREAK_UNIT: Record<Freq, string> = { daily: 'day', twice_daily: 'day', weekly: 'week', monthly: 'month', as_needed: '' };

const fmtDay = (s: string) => format(parseDay(s), 'd MMM');

// A key that buckets a date into the item's period, so checks can be counted per period.
function periodKey(freq: Freq, d: Date): string {
  if (freq === 'weekly') return format(d, 'RRRR-II'); // ISO week-year + ISO week
  if (freq === 'monthly') return format(d, 'yyyy-MM');
  return format(d, 'yyyy-MM-dd'); // daily / twice_daily
}
function prevPeriod(freq: Freq, d: Date): Date {
  if (freq === 'weekly') return subWeeks(d, 1);
  if (freq === 'monthly') return subMonths(d, 1);
  return subDays(d, 1);
}

/** Consecutive completed periods ending now (or the previous period if the current one isn't met yet). */
function computeStreak(freq: Freq, target: number, periodCounts: Map<string, number>, now: Date): number {
  if (target === 0) return 0;
  let cursor = now;
  if ((periodCounts.get(periodKey(freq, cursor)) ?? 0) < target) cursor = prevPeriod(freq, cursor);
  let streak = 0;
  while ((periodCounts.get(periodKey(freq, cursor)) ?? 0) >= target) {
    streak += 1;
    cursor = prevPeriod(freq, cursor);
  }
  return streak;
}

function rangeText(start?: string, end?: string): string {
  if (start && end) return `${fmtDay(start)}–${fmtDay(end)}`;
  if (start) return `from ${fmtDay(start)}`;
  if (end) return `until ${fmtDay(end)}`;
  return '';
}
function scheduleLabel(s: ActionableSchedule): string {
  if (s.type === 'finite') {
    const times = s.targetCount === 1 ? 'One-time' : `${s.targetCount}×`;
    return s.deadline ? `${times} · by ${fmtDay(s.deadline)}` : times;
  }
  const range = rangeText(s.startDate, s.endDate);
  return range ? `${FREQ_LABEL[s.frequency]} · ${range}` : FREQ_LABEL[s.frequency];
}

type ItemState = {
  target: number; // slots to render (0 = no check-off control, e.g. as-needed)
  count: number; // completions in scope (period for repeating, all-time for finite)
  complete: boolean;
  streak: number;
  streakUnit: string;
  slots: CheckLog[]; // in-scope checks, newest first (for un-checking)
  status: Status;
  tracked: boolean; // counts toward the "on track" summary
  asNeeded: boolean;
};

function computeState(item: Item, checksByItem: Map<string, CheckLog[]>, now: Date): ItemState {
  const all = (checksByItem.get(item.id) ?? []).slice().sort((a, b) => (a.loggedAt < b.loggedAt ? 1 : -1));
  const todayStr = dayKey(now);
  const s = item.schedule;

  if (s.type === 'finite') {
    const target = s.targetCount;
    const count = all.length;
    const complete = count >= target;
    const status: Status = !complete && s.deadline && todayStr > s.deadline ? 'overdue' : 'active';
    return {
      target,
      count,
      complete,
      streak: 0,
      streakUnit: '',
      slots: all,
      status,
      tracked: true,
      asNeeded: false,
    };
  }

  const freq = s.frequency;
  let status: Status = 'active';
  if (s.startDate && todayStr < s.startDate) status = 'upcoming';
  else if (s.endDate && todayStr > s.endDate) status = 'ended';

  const target = TARGET[freq];
  const curKey = periodKey(freq, now);
  const periodChecks = all.filter((c) => periodKey(freq, new Date(c.loggedAt)) === curKey);

  const periodCounts = new Map<string, number>();
  for (const c of all) {
    const k = periodKey(freq, new Date(c.loggedAt));
    periodCounts.set(k, (periodCounts.get(k) ?? 0) + 1);
  }

  const active = status === 'active';
  const count = active ? periodChecks.length : 0;
  return {
    target: active ? target : 0,
    count,
    complete: target > 0 && count >= target,
    streak: active ? computeStreak(freq, target, periodCounts, now) : 0,
    streakUnit: STREAK_UNIT[freq],
    slots: periodChecks,
    status,
    tracked: active && target > 0,
    asNeeded: freq === 'as_needed',
  };
}

const isItem = (l: CareLog<ActionableData>): l is CareLog<ActionableItemData> => l.data.kind === 'actionable_item';
const isCheck = (l: CareLog<ActionableData>): l is CheckLog => l.data.kind === 'actionable_check';

// Older rows may predate `schedule`; fall back so they still render.
function normalizeSchedule(data: ActionableItemData): ActionableSchedule {
  if (data.schedule) return data.schedule;
  const legacy = (data as { frequency?: Freq }).frequency;
  return { type: 'repeating', frequency: legacy ?? 'daily' };
}

const STATUS_RANK: Record<Status, number> = { overdue: 0, active: 1, upcoming: 2, ended: 3 };

/** Actionables: the mother's own to-dos (name / what to do / schedule / linked-to), with
 *  frequency- and deadline-aware completion and streaks. Empty until she adds her first one. */
export function ActionablesLogger({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  // null = list; otherwise the add/edit form (with `existing` when editing).
  const [form, setForm] = useState<{ existing?: Item } | null>(null);
  const [logs, setLogs] = useState<CareLog<ActionableData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const tempSeq = useRef(0); // monotonic ids for optimistic checks before the server assigns one

  const load = useCallback(async () => {
    try {
      const fresh = await listActionables();
      setLogs(fresh);
      setStale(false);
    } catch {
      // Network/timeout: show the offline mirror instead of hanging.
      const cached = await loadLogCache<ActionableData>('actionable');
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

  // ── Derive items + per-item state from the raw logs ──
  const now = new Date();
  const checksByItem = new Map<string, CheckLog[]>();
  for (const c of logs.filter(isCheck)) {
    const arr = checksByItem.get(c.data.itemId) ?? [];
    arr.push(c);
    checksByItem.set(c.data.itemId, arr);
  }
  const items: Item[] = logs.filter(isItem).map((l) => ({
    id: l.id,
    label: l.data.label,
    instruction: l.data.instruction,
    schedule: normalizeSchedule(l.data),
    loggedAt: l.loggedAt,
  }));
  const states = new Map(items.map((i) => [i.id, computeState(i, checksByItem, now)] as const));
  items.sort((a, b) => STATUS_RANK[states.get(a.id)!.status] - STATUS_RANK[states.get(b.id)!.status]);

  const tracked = items.filter((i) => states.get(i.id)!.tracked);
  const doneCount = tracked.filter((i) => states.get(i.id)!.complete).length;
  const progress = tracked.length ? doneCount / tracked.length : 0;

  async function increment(item: Item) {
    const ts = new Date();
    tempSeq.current += 1;
    const tempId = `temp-${item.id}-${tempSeq.current}`;
    const optimistic: CareLog<ActionableData> = {
      id: tempId,
      loggedAt: ts.toISOString(),
      data: { kind: 'actionable_check', itemId: item.id },
    };
    setLogs((l) => [optimistic, ...l]);
    try {
      const real = await addActionableCheck(userId, item.id, ts);
      setLogs((l) => l.map((x) => (x.id === tempId ? real : x)));
    } catch (e) {
      setLogs((l) => l.filter((x) => x.id !== tempId)); // revert
      Alert.alert('Could not update', errorMessage(e));
    }
  }

  async function removeCheck(checkLog: CheckLog) {
    const prev = logs;
    setLogs((l) => l.filter((x) => x.id !== checkLog.id)); // optimistic
    try {
      await deleteLog(checkLog.id, 'actionable');
    } catch (e) {
      setLogs(prev); // revert
      Alert.alert('Could not update', errorMessage(e));
    }
  }

  // Tap a completion slot: filled → un-check (remove newest); empty → check.
  function tapSlot(item: Item, state: ItemState, index: number) {
    if (index < state.count) void removeCheck(state.slots[0]);
    else void increment(item);
  }

  function confirmRemove(item: Item) {
    Alert.alert('Remove actionable?', `“${item.label}” will be removed from your list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== item.id)); // optimistic
          try {
            await deleteLog(item.id, 'actionable');
          } catch (e) {
            setLogs(prev); // revert
            Alert.alert('Could not remove', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (form) {
    const editing = form.existing;
    return (
      <AddItemForm
        userId={userId}
        existing={editing}
        onCancel={() => setForm(null)}
        onSaved={(log) => {
          setLogs((l) => (editing ? l.map((x) => (x.id === log.id ? log : x)) : [log, ...l]));
          setForm(null);
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
        <AppText variant="subtitle">Actionables</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Add an actionable" icon="add" onPress={() => setForm({})} />

        {stale ? (
          <Pill label="Showing saved list — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : items.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name="checkmark-done-outline" size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No actionables yet
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              Add the things you want to keep up with — daily vitamins, a one-time blood test, a weekly weigh-in — set
              how often, and a date range or deadline if it has one.
            </AppText>
          </Card>
        ) : (
          <>
            {tracked.length ? (
              <Card style={{ gap: t.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AppText variant="label">ON TRACK</AppText>
                  <AppText variant="caption">
                    {doneCount} of {tracked.length} up to date
                  </AppText>
                </View>
                <View
                  style={{
                    height: 8,
                    borderRadius: t.radius.pill,
                    backgroundColor: t.colors.surfaceMuted,
                    overflow: 'hidden',
                  }}>
                  <View
                    style={{
                      width: `${Math.round(progress * 100)}%`,
                      height: '100%',
                      borderRadius: t.radius.pill,
                      backgroundColor: t.colors.accent,
                    }}
                  />
                </View>
              </Card>
            ) : null}

            {items.map((item, i) => (
              <Animated.View key={item.id} entering={entering(i * 50)}>
                <ActionableCard
                  item={item}
                  state={states.get(item.id)!}
                  onTapSlot={(index) => tapSlot(item, states.get(item.id)!, index)}
                  onLogAsNeeded={() => increment(item)}
                  onEdit={() => setForm({ existing: item })}
                  onRemove={() => confirmRemove(item)}
                />
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({ status, schedule }: { status: Status; schedule: ActionableSchedule }) {
  if (status === 'overdue') return <Pill label="Overdue" tone="danger" icon="alert-circle-outline" />;
  if (status === 'ended') return <Pill label="Ended" tone="neutral" icon="checkmark-outline" />;
  if (status === 'upcoming' && schedule.type === 'repeating' && schedule.startDate)
    return <Pill label={`Starts ${fmtDay(schedule.startDate)}`} tone="neutral" icon="time-outline" />;
  return null;
}

function ActionableCard({
  item,
  state,
  onTapSlot,
  onLogAsNeeded,
  onEdit,
  onRemove,
}: {
  item: Item;
  state: ItemState;
  onTapSlot: (index: number) => void;
  onLogAsNeeded: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useTheme();
  const isFinite = item.schedule.type === 'finite';
  const tileActive = state.complete;
  const showSlots = state.status !== 'upcoming' && state.status !== 'ended' && state.target > 0;
  const showAsNeeded = state.asNeeded && state.status === 'active';

  return (
    <Card style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: t.radius.md,
            backgroundColor: tileActive ? t.colors.accentSoft : t.colors.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons
            name={state.complete ? 'checkmark-done' : isFinite ? 'flag-outline' : 'leaf-outline'}
            size={22}
            color={tileActive ? t.colors.accent : t.colors.textTertiary}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subtitle">{item.label}</AppText>
          {item.instruction ? <AppText variant="bodyMuted">{item.instruction}</AppText> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.label}`}
            hitSlop={10}
            onPress={onEdit}>
            <Ionicons name="create-outline" size={20} color={t.colors.textTertiary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.label}`}
            hitSlop={10}
            onPress={onRemove}>
            <Ionicons name="trash-outline" size={20} color={t.colors.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View
        style={{
          marginLeft: 44 + t.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: t.spacing.sm,
        }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, flex: 1 }}>
          <Pill label={scheduleLabel(item.schedule)} tone="neutral" icon={isFinite ? 'flag-outline' : 'repeat-outline'} />
          <StatusPill status={state.status} schedule={item.schedule} />
          {state.streak > 0 ? (
            <Pill label={`${state.streak}-${state.streakUnit} streak`} tone="accent" icon="flame-outline" />
          ) : null}
          {isFinite && state.target > 1 ? (
            <Pill label={`${state.count}/${state.target} done`} tone={state.complete ? 'success' : 'neutral'} />
          ) : null}
        </View>

        {showAsNeeded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Log ${item.label} done`}
            hitSlop={8}
            onPress={onLogAsNeeded}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.xs,
              paddingHorizontal: t.spacing.md,
              paddingVertical: t.spacing.xs,
              borderRadius: t.radius.pill,
              borderWidth: 1.5,
              borderColor: t.colors.accent,
            }}>
            <Ionicons name="add" size={16} color={t.colors.accent} />
            <AppText variant="caption" color={t.colors.accent}>
              Log done
            </AppText>
          </Pressable>
        ) : showSlots ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {Array.from({ length: state.target }).map((_, index) => {
              const filled = index < state.count;
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityState={{ checked: filled }}
                  accessibilityLabel={filled ? 'Mark not done' : 'Mark done'}
                  hitSlop={8}
                  onPress={() => onTapSlot(index)}>
                  <Ionicons
                    name={filled ? 'checkmark-circle' : 'ellipse-outline'}
                    size={32}
                    color={filled ? t.colors.accent : t.colors.border}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AddItemForm({
  userId,
  existing,
  onCancel,
  onSaved,
}: {
  userId: string;
  existing?: Item;
  onCancel: () => void;
  onSaved: (log: CareLog<ActionableData>) => void;
}) {
  const t = useTheme();
  const [label, setLabel] = useState(existing?.label ?? '');
  const [instruction, setInstruction] = useState(existing?.instruction ?? '');
  const [draft, setDraft] = useState<ScheduleDraft>(() =>
    existing ? splitSchedule(existing.schedule) : emptyScheduleDraft(),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    const name = label.trim();
    if (!name) {
      setError('Please name the actionable');
      return;
    }
    const dateError = validateSchedule(draft);
    if (dateError) {
      Alert.alert('Check the dates', dateError);
      return;
    }
    setError('');
    setSaving(true);
    const item = {
      label: name,
      instruction: instruction.trim() || undefined,
      schedule: buildSchedule(draft),
    };
    try {
      const log = existing
        ? await updateActionableItem(existing.id, item, parseISO(existing.loggedAt))
        : await addActionableItem(userId, item);
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
          <AppText variant="subtitle">{existing ? 'Edit actionable' : 'Add an actionable'}</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Card style={{ gap: t.spacing.lg }}>
            <Field
              label="Name"
              placeholder="e.g. Prenatal vitamins"
              value={label}
              onChangeText={setLabel}
              error={error}
              autoFocus={!existing}
            />
            <Field
              label="What to do (optional)"
              placeholder="e.g. Take one tablet with breakfast"
              value={instruction}
              onChangeText={setInstruction}
              multiline
            />
          </Card>

          <Card style={{ gap: t.spacing.lg }}>
            <ScheduleFields draft={draft} onChange={setDraft} />
          </Card>

          <View style={{ gap: t.spacing.xs }}>
            <AppText variant="label">LINKED TO</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Connect to a prescription or appointment"
              onPress={() =>
                Alert.alert(
                  'Coming soon',
                  'Soon you’ll be able to link this to a prescription or an appointment from your care team.',
                )
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.md,
                backgroundColor: t.colors.surfaceMuted,
                borderRadius: t.radius.md,
                borderWidth: 1,
                borderColor: t.colors.border,
                padding: t.spacing.lg,
              }}>
              <Ionicons name="link-outline" size={20} color={t.colors.textTertiary} />
              <AppText variant="body" color={t.colors.textSecondary} style={{ flex: 1 }}>
                Connect to a prescription or appointment
              </AppText>
              <Pill label="Coming soon" tone="neutral" />
            </Pressable>
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button
            label={saving ? 'Saving…' : existing ? 'Save changes' : 'Add actionable'}
            icon="checkmark"
            onPress={save}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
