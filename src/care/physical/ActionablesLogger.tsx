import { Ionicons } from '@expo/vector-icons';
import { format, subDays, subMonths, subWeeks } from 'date-fns';
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
  type ActionableCheckData,
  type ActionableData,
  type ActionableFrequency,
  type ActionableItemData,
  type ActionableSchedule,
  type CareLog,
} from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, ChipSelect, DateField, Field, Pill } from '@/ui';

type Freq = ActionableFrequency;
type Item = { id: string; label: string; instruction?: string; schedule: ActionableSchedule };
type CheckLog = CareLog<ActionableCheckData>;
type Status = 'active' | 'upcoming' | 'ended' | 'overdue';

const FREQS: Freq[] = ['daily', 'twice_daily', 'weekly', 'monthly', 'as_needed'];
const FREQ_LABEL: Record<Freq, string> = {
  daily: 'Daily',
  twice_daily: 'Twice daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  as_needed: 'As needed',
};
// How many completions a single period needs (0 = no required cadence).
const TARGET: Record<Freq, number> = { daily: 1, twice_daily: 2, weekly: 1, monthly: 1, as_needed: 0 };
const STREAK_UNIT: Record<Freq, string> = { daily: 'day', twice_daily: 'day', weekly: 'week', monthly: 'month', as_needed: '' };

const COUNT_OPTIONS = ['Once', 'Twice', '3 times', '4 times', '5 times'];
const countToLabel = (n: number) => COUNT_OPTIONS[Math.min(Math.max(n, 1), 5) - 1];
const labelToCount = (l: string) => COUNT_OPTIONS.indexOf(l) + 1;

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
// Parse a 'yyyy-MM-dd' as local midnight so day comparisons don't shift across the UTC boundary.
const parseDay = (s: string) => new Date(`${s}T00:00:00`);
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
  const [mode, setMode] = useState<'list' | 'add'>('list');
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

  if (mode === 'add') {
    return (
      <AddItemForm
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
        <Button label="Add an actionable" icon="add" onPress={() => setMode('add')} />

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
  onRemove,
}: {
  item: Item;
  state: ItemState;
  onTapSlot: (index: number) => void;
  onLogAsNeeded: () => void;
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.label}`}
          hitSlop={10}
          onPress={onRemove}>
          <Ionicons name="trash-outline" size={20} color={t.colors.textTertiary} />
        </Pressable>
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

function AddItemForm({
  userId,
  onCancel,
  onSaved,
}: {
  userId: string;
  onCancel: () => void;
  onSaved: (log: CareLog<ActionableData>) => void;
}) {
  const t = useTheme();
  const [label, setLabel] = useState('');
  const [instruction, setInstruction] = useState('');
  const [scheduleType, setScheduleType] = useState<'repeating' | 'finite'>('repeating');
  const [frequency, setFrequency] = useState<Freq>('daily');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [targetCount, setTargetCount] = useState(1);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function buildSchedule(): ActionableSchedule {
    if (scheduleType === 'repeating') {
      return {
        type: 'repeating',
        frequency,
        ...(startDate ? { startDate: dayKey(startDate) } : {}),
        ...(endDate ? { endDate: dayKey(endDate) } : {}),
      };
    }
    return { type: 'finite', targetCount, ...(deadline ? { deadline: dayKey(deadline) } : {}) };
  }

  async function save() {
    if (saving) return;
    const name = label.trim();
    if (!name) {
      setError('Please name the actionable');
      return;
    }
    if (scheduleType === 'repeating' && startDate && endDate && endDate < startDate) {
      Alert.alert('Check the dates', 'The end date can’t be before the start date.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const log = await addActionableItem(userId, {
        label: name,
        instruction: instruction.trim() || undefined,
        schedule: buildSchedule(),
      });
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
          <AppText variant="subtitle">Add an actionable</AppText>
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
              autoFocus
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
            <ChipSelect
              label="Schedule"
              options={['Repeating', 'One-off']}
              value={[scheduleType === 'repeating' ? 'Repeating' : 'One-off']}
              onChange={(next) => {
                if (next[0]) setScheduleType(next[0] === 'One-off' ? 'finite' : 'repeating');
              }}
              hint={
                scheduleType === 'repeating'
                  ? 'Recurs on a cadence — optionally only between two dates.'
                  : 'A fixed number of times, optionally by a deadline.'
              }
            />

            {scheduleType === 'repeating' ? (
              <>
                <ChipSelect
                  label="How often?"
                  options={FREQS.map((f) => FREQ_LABEL[f])}
                  value={[FREQ_LABEL[frequency]]}
                  onChange={(next) => {
                    const found = FREQS.find((f) => FREQ_LABEL[f] === next[0]);
                    if (found) setFrequency(found);
                  }}
                />
                <View style={{ gap: t.spacing.sm }}>
                  <AppText variant="label">ACTIVE PERIOD (OPTIONAL)</AppText>
                  <OptionalDateRow addLabel="Add a start date" fieldLabel="Start date" value={startDate} set={setStartDate} />
                  <OptionalDateRow
                    addLabel="Add an end date"
                    fieldLabel="End date"
                    value={endDate}
                    set={setEndDate}
                    minimumDate={startDate ?? undefined}
                  />
                </View>
              </>
            ) : (
              <>
                <ChipSelect
                  label="How many times?"
                  options={COUNT_OPTIONS}
                  value={[countToLabel(targetCount)]}
                  onChange={(next) => {
                    const n = labelToCount(next[0] ?? '');
                    if (n > 0) setTargetCount(n);
                  }}
                />
                <View style={{ gap: t.spacing.sm }}>
                  <AppText variant="label">DEADLINE (OPTIONAL)</AppText>
                  <OptionalDateRow
                    addLabel="Add a deadline"
                    fieldLabel="Deadline"
                    value={deadline}
                    set={setDeadline}
                  />
                </View>
              </>
            )}
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
          <Button label={saving ? 'Saving…' : 'Add actionable'} icon="checkmark" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
