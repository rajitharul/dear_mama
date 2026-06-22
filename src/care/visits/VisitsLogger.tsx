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
  TextInput,
  View,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addActionableItem,
  addVisit,
  deleteLog,
  listActionables,
  listVisits,
  updateVisit,
  type ActionableItemData,
  type ActionableSchedule,
  type CareLog,
  type VisitData,
} from '@/care/api';
import { loadLogCache } from '@/care/cache';
import {
  buildSchedule,
  emptyScheduleDraft,
  FREQ_LABEL,
  ScheduleFields,
  validateSchedule,
  type ScheduleDraft,
} from '@/care/physical/scheduleFields';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, DateField, Field, Pill } from '@/ui';

const isUpcomingAt = (loggedAt: string, now: number) => new Date(loggedAt).getTime() > now;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ── Promoting a visit item to an Actionable ──
// The created actionable is linked back to the visit via ActionableItemData.link.
type ScheduleKind = 'repeating' | 'finite';

const scheduleShort = (s: ActionableSchedule): string => {
  if (s.type === 'finite') return s.targetCount === 1 ? 'One-time' : `${s.targetCount}×`;
  return FREQ_LABEL[s.frequency];
};

/**
 * Visits logger (Visits pillar): a history of antenatal appointments + forms to record one
 * or edit an existing one. A visit is a single self-contained record. A future date means an
 * *upcoming* appointment (derived from the date) — those only capture place/doctor/date and
 * what to prepare; the notes, prescription and tests are filled in later by editing.
 */
export function VisitsLogger({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [now] = useState(() => Date.now());
  const [logs, setLogs] = useState<CareLog<VisitData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<CareLog<VisitData> | null>(null);
  const [editing, setEditing] = useState<CareLog<VisitData> | null>(null);

  const load = useCallback(async () => {
    try {
      const fresh = await listVisits();
      setLogs(fresh);
      setStale(false);
    } catch {
      // Network/timeout: show the offline mirror instead of hanging.
      const cached = await loadLogCache<VisitData>('visit');
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

  function confirmDelete(log: CareLog<VisitData>) {
    Alert.alert('Delete visit?', 'This will remove it from your records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          setDetail(null);
          try {
            await deleteLog(log.id, 'visit');
          } catch (e) {
            setLogs(prev); // revert
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (adding || editing) {
    return (
      <VisitForm
        userId={userId}
        existing={editing ?? undefined}
        onCancel={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSaved={(log) => {
          setLogs((l) => (editing ? l.map((x) => (x.id === log.id ? log : x)) : [log, ...l]));
          setAdding(false);
          setEditing(null);
          setDetail(editing ? log : null);
        }}
      />
    );
  }

  if (detail) {
    return (
      <VisitDetail
        userId={userId}
        log={detail}
        now={now}
        onBack={() => setDetail(null)}
        onEdit={() => setEditing(detail)}
        onDelete={() => confirmDelete(detail)}
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
        <AppText variant="subtitle">Visits</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Button label="Record a visit" icon="add" onPress={() => setAdding(true)} />

        {stale ? (
          <Pill label="Showing saved visits — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : logs.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.xxl }}>
            <Ionicons name="medical-outline" size={36} color={t.colors.accent} />
            <AppText variant="subtitle" center>
              No visits recorded
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 280 }}>
              Tap “Record a visit” to note an appointment — what your doctor said, what was prescribed, or
              to schedule one coming up.
            </AppText>
          </Card>
        ) : (
          logs.map((log, i) => {
            const v = log.data;
            const upcoming = isUpcomingAt(log.loggedAt, now);
            const summary: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [];
            if (v.medicines.length) summary.push({ label: plural(v.medicines.length, 'medicine', 'medicines'), icon: 'medkit-outline' });
            if (v.supplements.length) summary.push({ label: plural(v.supplements.length, 'supplement', 'supplements'), icon: 'leaf-outline' });
            if (v.tests.length) summary.push({ label: plural(v.tests.length, 'test', 'tests'), icon: 'document-text-outline' });
            if (v.routines.length) summary.push({ label: plural(v.routines.length, 'routine', 'routines'), icon: 'checkmark-done-outline' });
            return (
              <Animated.View key={log.id} entering={entering(i * 50)}>
                <Card onPress={() => setDetail(log)} style={{ gap: t.spacing.sm }}>
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
                      <Ionicons name="medical-outline" size={22} color={t.colors.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="subtitle">{v.place}</AppText>
                      <AppText variant="caption">
                        {format(new Date(log.loggedAt), 'd MMM yyyy · h:mm a')}
                        {v.doctor ? ` · ${v.doctor}` : ''}
                      </AppText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete visit"
                      hitSlop={10}
                      onPress={() => confirmDelete(log)}>
                      <Ionicons name="trash-outline" size={20} color={t.colors.textTertiary} />
                    </Pressable>
                  </View>
                  {upcoming ? (
                    <View style={{ marginLeft: 44 + t.spacing.md }}>
                      <Pill label="Upcoming" tone="accent" icon="calendar-outline" />
                    </View>
                  ) : summary.length ? (
                    <View style={{ marginLeft: 44 + t.spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                      {summary.map((s) => (
                        <Pill key={s.label} label={s.label} tone="neutral" icon={s.icon} />
                      ))}
                    </View>
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

/** Read-only detail of a single visit, with Edit / Delete actions and per-item "add to actionables". */
function VisitDetail({
  userId,
  log,
  now,
  onBack,
  onEdit,
  onDelete,
}: {
  userId: string;
  log: CareLog<VisitData>;
  now: number;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const v = log.data;
  const upcoming = isUpcomingAt(log.loggedAt, now);

  // Which item labels are already promoted to Actionables (linked to this visit).
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const [promoting, setPromoting] = useState<{ label: string; defaultKind: ScheduleKind } | null>(null);

  const loadPromoted = useCallback(async () => {
    try {
      const all = await listActionables();
      const labels = all
        .filter(
          (l): l is CareLog<ActionableItemData> =>
            l.data.kind === 'actionable_item' && l.data.link === log.id,
        )
        .map((l) => l.data.label);
      setPromoted(new Set(labels));
    } catch {
      // best-effort: if it fails we simply show the "add" buttons
    }
  }, [log.id]);

  useEffect(() => {
    // setPromoted runs only after awaited work, so the cascading-render rule doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPromoted();
  }, [loadPromoted]);

  if (promoting) {
    return (
      <SchedulePicker
        label={promoting.label}
        defaultKind={promoting.defaultKind}
        onCancel={() => setPromoting(null)}
        onPick={async (schedule) => {
          await addActionableItem(userId, { label: promoting.label, schedule, link: log.id });
          setPromoted((s) => new Set(s).add(promoting.label));
          setPromoting(null);
        }}
      />
    );
  }

  const promote = (kind: ScheduleKind) => (label: string) => setPromoting({ label, defaultKind: kind });

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
        <AppText variant="subtitle" style={{ flex: 1 }}>
          Visit
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Delete visit" hitSlop={10} onPress={onDelete}>
          <Ionicons name="trash-outline" size={22} color={t.colors.textTertiary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: t.spacing.xs }}>
          <AppText variant="display">{v.place}</AppText>
          <AppText variant="bodyMuted">
            {format(new Date(log.loggedAt), 'EEEE, d MMM yyyy · h:mm a')}
            {v.doctor ? ` · ${v.doctor}` : ''}
          </AppText>
          {upcoming ? <Pill label="Upcoming" tone="accent" icon="calendar-outline" /> : null}
        </View>

        {v.notes ? (
          <Card style={{ gap: t.spacing.sm }}>
            <AppText variant="label">DOCTOR’S DIAGNOSIS</AppText>
            <AppText variant="body">{v.notes}</AppText>
          </Card>
        ) : null}

        {v.prerequisites ? (
          <Card style={{ gap: t.spacing.sm }}>
            <AppText variant="label">{upcoming ? 'TO PREPARE' : 'PREREQUISITES FOR NEXT VISIT'}</AppText>
            <AppText variant="body">{v.prerequisites}</AppText>
          </Card>
        ) : null}

        <ListSection
          title="MEDICINE"
          icon="medkit-outline"
          items={v.medicines}
          promoted={promoted}
          onPromote={promote('repeating')}
        />
        <ListSection
          title="SUPPLEMENTS"
          icon="leaf-outline"
          items={v.supplements}
          promoted={promoted}
          onPromote={promote('repeating')}
        />
        <ListSection
          title="TESTS / SCANS"
          icon="document-text-outline"
          items={v.tests}
          promoted={promoted}
          onPromote={promote('finite')}
        />
        <ListSection
          title="ROUTINES"
          icon="checkmark-done-outline"
          items={v.routines}
          promoted={promoted}
          onPromote={promote('repeating')}
        />

        <Button label="Edit visit" variant="secondary" icon="create-outline" onPress={onEdit} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ListSection({
  title,
  icon,
  items,
  promoted,
  onPromote,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
  promoted: Set<string>;
  onPromote: (label: string) => void;
}) {
  const t = useTheme();
  if (!items.length) return null;
  return (
    <Card style={{ gap: t.spacing.md }}>
      <AppText variant="label">{title}</AppText>
      {items.map((item, i) => {
        const isPromoted = promoted.has(item);
        return (
          <View key={`${item}-${i}`} style={{ gap: t.spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <Ionicons name={icon} size={18} color={t.colors.accent} />
              <AppText variant="body" style={{ flex: 1 }}>
                {item}
              </AppText>
            </View>
            <View style={{ marginLeft: 18 + t.spacing.md }}>
              {isPromoted ? (
                <Pill label="In actionables" tone="success" icon="checkmark-circle-outline" />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item} to actionables`}
                  hitSlop={6}
                  onPress={() => onPromote(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                  <Ionicons name="add-circle-outline" size={16} color={t.colors.accent} />
                  <AppText variant="caption" color={t.colors.accent}>
                    Add to actionables
                  </AppText>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick a schedule for promoting a visit item to an Actionable. `onPick` receives the chosen
 * schedule; it may be async (the detail screen creates the actionable immediately, the record
 * form just stashes it until the visit is saved). Errors thrown by `onPick` are surfaced here.
 */
function SchedulePicker({
  label,
  defaultKind,
  onCancel,
  onPick,
}: {
  label: string;
  defaultKind: ScheduleKind;
  onCancel: () => void;
  onPick: (schedule: ActionableSchedule) => void | Promise<void>;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState<ScheduleDraft>(() => emptyScheduleDraft(defaultKind));
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (saving) return;
    const dateError = validateSchedule(draft);
    if (dateError) {
      Alert.alert('Check the dates', dateError);
      return;
    }
    setSaving(true);
    try {
      await onPick(buildSchedule(draft));
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not add', errorMessage(e));
    }
  }

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
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={12} onPress={onCancel}>
          <Ionicons name="chevron-back" size={26} color={t.colors.text} />
        </Pressable>
        <AppText variant="subtitle">Add to actionables</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Card style={{ gap: t.spacing.sm }}>
          <AppText variant="label">ACTIONABLE</AppText>
          <AppText variant="body">{label}</AppText>
        </Card>

        <Card style={{ gap: t.spacing.lg }}>
          <ScheduleFields draft={draft} onChange={setDraft} />
        </Card>
      </ScrollView>

      <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
        <Button label={saving ? 'Adding…' : 'Add to actionables'} icon="checkmark" onPress={confirm} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * A list input (like ChipListInput) where each item can also be flagged "add to actionables"
 * while recording. `pending` holds items chosen this session (label → schedule); `already`
 * holds items already linked to the visit from a previous edit (shown locked).
 */
function PromotableListInput({
  label,
  placeholder,
  items,
  onChange,
  pending,
  already,
  onRequestPromote,
  onUnpromote,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
  pending: Map<string, ActionableSchedule>;
  already: Set<string>;
  onRequestPromote: (item: string) => void;
  onUnpromote: (item: string) => void;
}) {
  const t = useTheme();
  const [text, setText] = useState('');

  function add() {
    const v = text.trim();
    if (!v) return;
    if (!items.includes(v)) onChange([...items, v]);
    setText('');
  }

  function remove(item: string) {
    onChange(items.filter((x) => x !== item));
    onUnpromote(item); // drop any pending promotion for the removed item
  }

  return (
    <View style={{ gap: t.spacing.sm }}>
      <AppText variant="label">{label}</AppText>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={t.colors.textTertiary}
          onSubmitEditing={add}
          returnKeyType="done"
          style={{
            flex: 1,
            backgroundColor: t.colors.surface,
            borderWidth: 1.5,
            borderColor: t.colors.border,
            borderRadius: t.radius.md,
            paddingHorizontal: t.spacing.lg,
            paddingVertical: t.spacing.md,
            fontSize: t.fontSize.md,
            fontFamily: t.fonts.body,
            color: t.colors.text,
            minHeight: 50,
          }}
        />
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel="Add"
          style={{
            width: 50,
            height: 50,
            borderRadius: t.radius.md,
            backgroundColor: t.colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="add" size={24} color={t.colors.accent} />
        </Pressable>
      </View>

      {items.map((item) => {
        const isAlready = already.has(item);
        const sched = pending.get(item);
        return (
          <View key={item} style={{ gap: t.spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Ionicons name="ellipse" size={6} color={t.colors.textTertiary} />
              <AppText variant="body" style={{ flex: 1 }}>
                {item}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item}`}
                hitSlop={8}
                onPress={() => remove(item)}>
                <Ionicons name="close" size={18} color={t.colors.textTertiary} />
              </Pressable>
            </View>
            <View style={{ marginLeft: 6 + t.spacing.sm }}>
              {isAlready ? (
                <Pill label="In actionables" tone="success" icon="checkmark-circle-outline" />
              ) : sched ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Don’t add ${item} to actionables`}
                  hitSlop={6}
                  onPress={() => onUnpromote(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                  <Pill label={`Actionable · ${scheduleShort(sched)}`} tone="accent" icon="checkmark-circle-outline" />
                  <AppText variant="caption" color={t.colors.textTertiary}>
                    Undo
                  </AppText>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item} to actionables`}
                  hitSlop={6}
                  onPress={() => onRequestPromote(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                  <Ionicons name="add-circle-outline" size={16} color={t.colors.accent} />
                  <AppText variant="caption" color={t.colors.accent}>
                    Add to actionables
                  </AppText>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Record a new visit, or edit an existing one when `existing` is provided. */
function VisitForm({
  userId,
  existing,
  onCancel,
  onSaved,
}: {
  userId: string;
  existing?: CareLog<VisitData>;
  onCancel: () => void;
  onSaved: (log: CareLog<VisitData>) => void;
}) {
  const t = useTheme();
  const [place, setPlace] = useState(existing?.data.place ?? '');
  const [doctor, setDoctor] = useState(existing?.data.doctor ?? '');
  const [date, setDate] = useState<Date>(existing ? new Date(existing.loggedAt) : new Date());
  const [isUpcoming, setIsUpcoming] = useState(() => date.getTime() > Date.now());
  const [notes, setNotes] = useState(existing?.data.notes ?? '');
  const [prerequisites, setPrerequisites] = useState(existing?.data.prerequisites ?? '');
  const [medicines, setMedicines] = useState<string[]>(existing?.data.medicines ?? []);
  const [supplements, setSupplements] = useState<string[]>(existing?.data.supplements ?? []);
  const [tests, setTests] = useState<string[]>(existing?.data.tests ?? []);
  const [routines, setRoutines] = useState<string[]>(existing?.data.routines ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Items chosen this session to also become actionables (label → schedule), and items
  // already linked to this visit from a previous edit (shown as locked "In actionables").
  const [pending, setPending] = useState<Map<string, ActionableSchedule>>(new Map());
  const [already, setAlready] = useState<Set<string>>(new Set());
  const [promotingItem, setPromotingItem] = useState<{ label: string; defaultKind: ScheduleKind } | null>(null);

  const loadAlready = useCallback(async () => {
    if (!existing) return;
    try {
      const all = await listActionables();
      const labels = all
        .filter(
          (l): l is CareLog<ActionableItemData> =>
            l.data.kind === 'actionable_item' && l.data.link === existing.id,
        )
        .map((l) => l.data.label);
      setAlready(new Set(labels));
    } catch {
      // best-effort
    }
  }, [existing]);

  useEffect(() => {
    // setAlready runs only after awaited work, so the cascading-render rule doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAlready();
  }, [loadAlready]);

  const requestPromote = (kind: ScheduleKind) => (label: string) =>
    setPromotingItem({ label, defaultKind: kind });
  const unpromote = (label: string) =>
    setPending((m) => {
      if (!m.has(label)) return m;
      const next = new Map(m);
      next.delete(label);
      return next;
    });

  async function save() {
    if (saving) return;
    const name = place.trim();
    if (!name) {
      setError('Please enter where the visit was');
      return;
    }
    setError('');
    setSaving(true);
    // An upcoming visit hasn't happened yet — don't store the "what happened" sections.
    const sections = { medicines, supplements, tests, routines };
    const payload: VisitData = {
      kind: 'visit',
      place: name,
      doctor: doctor.trim() || undefined,
      prerequisites: prerequisites.trim() || undefined,
      notes: isUpcoming ? undefined : notes.trim() || undefined,
      medicines: isUpcoming ? [] : sections.medicines,
      supplements: isUpcoming ? [] : sections.supplements,
      tests: isUpcoming ? [] : sections.tests,
      routines: isUpcoming ? [] : sections.routines,
    };
    let log: CareLog<VisitData>;
    try {
      log = existing ? await updateVisit(existing.id, payload, date) : await addVisit(userId, payload, date);
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', errorMessage(e));
      return;
    }
    // Create the actionables flagged during recording, linked to the now-saved visit. Only
    // items that survived in a kept (non-upcoming) section. Visit is already saved, so a
    // failure here just warns rather than losing the record.
    if (!isUpcoming && pending.size) {
      const kept = new Set<string>([...sections.medicines, ...sections.supplements, ...sections.tests, ...sections.routines]);
      const toCreate = [...pending].filter(([label]) => kept.has(label) && !already.has(label));
      const results = await Promise.allSettled(
        toCreate.map(([label, schedule]) => addActionableItem(userId, { label, schedule, link: log.id })),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) {
        Alert.alert(
          'Visit saved',
          `But ${failed} ${failed === 1 ? 'actionable' : 'actionables'} couldn’t be added. You can add them from the visit.`,
        );
      }
    }
    onSaved(log);
  }

  if (promotingItem) {
    return (
      <SchedulePicker
        label={promotingItem.label}
        defaultKind={promotingItem.defaultKind}
        onCancel={() => setPromotingItem(null)}
        onPick={(schedule) => {
          setPending((m) => new Map(m).set(promotingItem.label, schedule));
          setPromotingItem(null);
        }}
      />
    );
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
          <AppText variant="subtitle">{existing ? 'Edit visit' : 'Record a visit'}</AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Card style={{ gap: t.spacing.lg }}>
            <Field
              label="Place"
              placeholder="e.g. City Hospital"
              value={place}
              onChangeText={(text) => {
                setPlace(text);
                if (error) setError('');
              }}
              error={error}
            />
            <Field label="Doctor (optional)" placeholder="e.g. Dr. Mehta" value={doctor} onChangeText={setDoctor} />
            <DateField
              label="Date & time"
              mode="datetime"
              value={date}
              onChange={(d) => {
                setDate(d);
                setIsUpcoming(d.getTime() > Date.now());
              }}
            />
          </Card>

          {isUpcoming ? (
            <Card style={{ gap: t.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                <Ionicons name="calendar-outline" size={18} color={t.colors.accent} />
                <AppText variant="bodyMuted" style={{ flex: 1 }}>
                  This visit hasn’t happened yet. After it, edit it to add the doctor’s diagnosis, prescription
                  and tests.
                </AppText>
              </View>
              <Field
                label="To prepare (optional)"
                placeholder="Anything to bring or do beforehand — fasting, documents…"
                value={prerequisites}
                onChangeText={setPrerequisites}
                multiline
              />
            </Card>
          ) : (
            <>
              <Card style={{ gap: t.spacing.lg }}>
                <Field
                  label="Doctor’s diagnosis (optional)"
                  placeholder="What your doctor found or diagnosed"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
                <Field
                  label="Prerequisites for next visit (optional)"
                  placeholder="Anything to prepare or bring next time"
                  value={prerequisites}
                  onChangeText={setPrerequisites}
                  multiline
                />
              </Card>

              <AppText variant="label">PRESCRIPTION</AppText>
              <Card style={{ gap: t.spacing.lg }}>
                <PromotableListInput
                  label="Medicine"
                  placeholder="e.g. Iron 65mg — daily"
                  items={medicines}
                  onChange={setMedicines}
                  pending={pending}
                  already={already}
                  onRequestPromote={requestPromote('repeating')}
                  onUnpromote={unpromote}
                />
                <PromotableListInput
                  label="Supplements"
                  placeholder="e.g. Folic acid — daily"
                  items={supplements}
                  onChange={setSupplements}
                  pending={pending}
                  already={already}
                  onRequestPromote={requestPromote('repeating')}
                  onUnpromote={unpromote}
                />
              </Card>

              <Card style={{ gap: t.spacing.lg }}>
                <PromotableListInput
                  label="Tests / scans"
                  placeholder="e.g. Anomaly scan"
                  items={tests}
                  onChange={setTests}
                  pending={pending}
                  already={already}
                  onRequestPromote={requestPromote('finite')}
                  onUnpromote={unpromote}
                />
                <PromotableListInput
                  label="Routines"
                  placeholder="e.g. 30 min walk daily"
                  items={routines}
                  onChange={setRoutines}
                  pending={pending}
                  already={already}
                  onRequestPromote={requestPromote('repeating')}
                  onUnpromote={unpromote}
                />
              </Card>
            </>
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button label={saving ? 'Saving…' : 'Save visit'} icon="checkmark" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
