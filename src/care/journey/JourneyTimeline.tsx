import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
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
  addJourney,
  deleteLog,
  listJourney,
  removeCareFiles,
  signedFileUrl,
  updateJourney,
  uploadCareFile,
  type CareLog,
  type JourneyCategory,
  type JourneyData,
  type PendingFile,
  type TestFileRef,
} from '@/care/api';
import { loadLogCache } from '@/care/cache';
import {
  derivedAnchors,
  JOURNEY_CATEGORIES,
  milestoneById,
  MILESTONES,
  type JourneyAnchor,
  type Milestone,
} from '@/care/journey/milestones';
import { errorMessage } from '@/lib/errors';
import type { OnboardingData } from '@/onboarding/types';
import { eddFromLmp, gestationalAge } from '@/pregnancy/weekMath';
import { useTheme } from '@/theme';
import { AppText, Button, calmRise, Card, ChipSelect, DateField, Field, Pill } from '@/ui';

const CATEGORY_ORDER: JourneyCategory[] = ['beginning', 'clinical', 'baby_body', 'prep'];

/** EDD from the onboarding date, mirroring Home. Null when no due date is set. */
function eddOf(data: OnboardingData): Date | null {
  if (!data.date) return null;
  const chosen = new Date(data.date);
  return data.dateMode === 'edd' ? chosen : eddFromLmp(chosen);
}

const weekOf = (edd: Date | null, iso: string): number | null =>
  edd ? Math.max(0, gestationalAge(edd, new Date(iso)).weeks) : null;

const weekRangeLabel = (m: Milestone): string | null => {
  if (m.weekFrom == null) return m.hint ?? null;
  if (m.weekTo == null || m.weekTo === m.weekFrom) return `Around week ${m.weekFrom}`;
  return `Weeks ${m.weekFrom}–${m.weekTo}`;
};

// ── Merged, week-ordered timeline ──
type TimelineRow =
  | { type: 'milestone'; key: string; sortWeek: number; milestone: Milestone; log: CareLog<JourneyData> | null }
  | { type: 'custom'; key: string; sortWeek: number; log: CareLog<JourneyData> }
  | { type: 'anchor'; key: string; sortWeek: number; anchor: JourneyAnchor }
  | { type: 'now'; key: string; sortWeek: number; week: number };

function buildRows(
  logs: CareLog<JourneyData>[],
  edd: Date | null,
  currentWeek: number | null,
): TimelineRow[] {
  const recorded = new Map<string, CareLog<JourneyData>>();
  const customs: CareLog<JourneyData>[] = [];
  for (const l of logs) {
    const id = l.data.milestoneId;
    if (id) {
      if (!recorded.has(id)) recorded.set(id, l); // listJourney is newest-first; keep the latest
    } else {
      customs.push(l);
    }
  }

  const rows: TimelineRow[] = [];
  for (const m of MILESTONES) {
    const log = recorded.get(m.id) ?? null;
    const w = log ? weekOf(edd, log.loggedAt) : null;
    rows.push({ type: 'milestone', key: `m-${m.id}`, sortWeek: w ?? m.weekFrom ?? 99, milestone: m, log });
  }
  for (const l of customs) {
    rows.push({ type: 'custom', key: `c-${l.id}`, sortWeek: weekOf(edd, l.loggedAt) ?? 98, log: l });
  }
  for (const a of derivedAnchors(edd)) {
    rows.push({ type: 'anchor', key: `a-${a.week}`, sortWeek: a.week + 0.5, anchor: a });
  }
  if (currentWeek != null) rows.push({ type: 'now', key: 'now', sortWeek: currentWeek + 0.25, week: currentWeek });

  return rows.sort((x, y) => x.sortWeek - y.sortWeek);
}

type FormTarget =
  | { milestone: Milestone } // mark a catalog milestone
  | { custom: true } // add a custom event
  | { existing: CareLog<JourneyData> }; // edit a recorded one

/**
 * Journey timeline: a week-ordered story of the pregnancy, merging the curated milestone
 * catalog (src/care/journey/milestones.ts) with what the mother has recorded and her own
 * custom events. Recorded milestones keep a date, a note, and photos; unrecorded ones invite
 * a tap to mark them. Passive trimester/term/due-date anchors orient the timeline in time, and
 * a "you're here" marker keys off the current gestational age (from the onboarding due date).
 */
export function JourneyTimeline({ userId, data }: { userId: string; data: OnboardingData }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [now] = useState(() => Date.now());
  const [logs, setLogs] = useState<CareLog<JourneyData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [detail, setDetail] = useState<CareLog<JourneyData> | null>(null);
  const [form, setForm] = useState<FormTarget | null>(null);

  const edd = eddOf(data);
  const currentWeek = edd ? Math.max(0, gestationalAge(edd, new Date(now)).weeks) : null;

  const load = useCallback(async () => {
    try {
      const fresh = await listJourney();
      setLogs(fresh);
      setStale(false);
    } catch {
      const cached = await loadLogCache<JourneyData>('journey');
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

  function confirmDelete(log: CareLog<JourneyData>) {
    Alert.alert('Remove milestone?', 'This will remove it and any photos from your journey.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const prev = logs;
          setLogs((l) => l.filter((x) => x.id !== log.id)); // optimistic
          setDetail(null);
          try {
            await removeCareFiles(log.data.files.map((f) => f.path));
            await deleteLog(log.id, 'journey');
          } catch (e) {
            setLogs(prev); // revert
            Alert.alert('Could not remove', errorMessage(e));
          }
        },
      },
    ]);
  }

  if (form) {
    const existing = 'existing' in form ? form.existing : undefined;
    const milestone = 'milestone' in form ? form.milestone : undefined;
    return (
      <JourneyMilestoneForm
        userId={userId}
        existing={existing}
        milestone={milestone}
        custom={'custom' in form}
        onCancel={() => setForm(null)}
        onSaved={(log) => {
          setLogs((l) => (existing ? l.map((x) => (x.id === log.id ? log : x)) : [log, ...l]));
          setForm(null);
          setDetail(log);
        }}
      />
    );
  }

  if (detail) {
    return (
      <JourneyDetail
        log={detail}
        edd={edd}
        onBack={() => setDetail(null)}
        onEdit={() => setForm({ existing: detail })}
        onDelete={() => confirmDelete(detail)}
      />
    );
  }

  const rows = buildRows(logs, edd, currentWeek);
  const recordedCount = logs.length;
  const entering = (delay: number) => (reduce ? undefined : calmRise(delay));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.xl, gap: t.spacing.lg, paddingBottom: t.spacing.xxxl }}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={entering(0)} style={{ gap: t.spacing.xs }}>
          <AppText variant="bodyMuted">Your story</AppText>
          <AppText variant="display">Journey</AppText>
          <AppText variant="bodyMuted" style={{ maxWidth: 320 }}>
            The milestones of your pregnancy — mark each one as it happens, with a note and a photo to keep.
          </AppText>
        </Animated.View>

        {stale ? (
          <Pill label="Showing your saved journey — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        <Button label="Add your own milestone" variant="secondary" icon="add" onPress={() => setForm({ custom: true })} />

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : (
          <View>
            {rows.map((row, i) => (
              <Animated.View key={row.key} entering={entering(Math.min(i, 8) * 40)}>
                <TimelineItem
                  row={row}
                  isFirst={i === 0}
                  isLast={i === rows.length - 1}
                  currentWeek={currentWeek}
                  onOpen={(log) => setDetail(log)}
                  onMark={(m) => setForm({ milestone: m })}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {!loading ? (
          <AppText variant="caption" center color={t.colors.textTertiary}>
            {recordedCount === 0
              ? 'Nothing marked yet — tap a milestone to begin.'
              : `${recordedCount} ${recordedCount === 1 ? 'moment' : 'moments'} kept`}
          </AppText>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** One row of the timeline: a left rail (line + dot) and the row's content to the right. */
function TimelineItem({
  row,
  isFirst,
  isLast,
  currentWeek,
  onOpen,
  onMark,
}: {
  row: TimelineRow;
  isFirst: boolean;
  isLast: boolean;
  currentWeek: number | null;
  onOpen: (log: CareLog<JourneyData>) => void;
  onMark: (m: Milestone) => void;
}) {
  const t = useTheme();

  // Dot styling per row type.
  let dot: { size: number; fill: string; border: string } = {
    size: 12,
    fill: t.colors.background,
    border: t.colors.border,
  };
  if (row.type === 'milestone' && row.log) dot = { size: 14, fill: t.colors.accent, border: t.colors.accent };
  else if (row.type === 'milestone') dot = { size: 12, fill: t.colors.background, border: t.colors.accent };
  else if (row.type === 'custom') dot = { size: 14, fill: t.colors.accent, border: t.colors.accent };
  else if (row.type === 'anchor') dot = { size: 8, fill: t.colors.textTertiary, border: t.colors.textTertiary };
  else if (row.type === 'now') dot = { size: 14, fill: t.colors.background, border: t.colors.accent };

  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.md, minHeight: 52 }}>
      {/* Rail */}
      <View style={{ width: 22, alignItems: 'center', alignSelf: 'stretch' }}>
        <View style={{ width: 2, height: 16, backgroundColor: isFirst ? 'transparent' : t.colors.border }} />
        <View
          style={{
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            backgroundColor: dot.fill,
            borderWidth: 2,
            borderColor: dot.border,
          }}
        />
        <View style={{ width: 2, flex: 1, backgroundColor: isLast ? 'transparent' : t.colors.border }} />
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingBottom: t.spacing.lg }}>
        {row.type === 'anchor' ? (
          <View style={{ paddingTop: 8 }}>
            <AppText variant="caption" color={t.colors.textTertiary}>
              {row.anchor.date ? `${row.anchor.label} · ${format(row.anchor.date, 'd MMM yyyy')}` : `${row.anchor.label} · week ${row.anchor.week}`}
            </AppText>
          </View>
        ) : row.type === 'now' ? (
          <View style={{ paddingTop: 6 }}>
            <Pill label={`You’re here · week ${row.week}`} tone="accent" icon="navigate-outline" />
          </View>
        ) : row.type === 'custom' ? (
          <RecordedCard log={row.log} category={row.log.data.category} onPress={() => onOpen(row.log)} />
        ) : row.log ? (
          <RecordedCard log={row.log} category={row.milestone.category} onPress={() => onOpen(row.log!)} />
        ) : (
          <UnrecordedRow milestone={row.milestone} currentWeek={currentWeek} onMark={() => onMark(row.milestone)} />
        )}
      </View>
    </View>
  );
}

/** A recorded milestone or custom event: title, category, date, note snippet, photo thumbs. */
function RecordedCard({
  log,
  category,
  onPress,
}: {
  log: CareLog<JourneyData>;
  category: JourneyCategory;
  onPress: () => void;
}) {
  const t = useTheme();
  const d = log.data;
  const cat = JOURNEY_CATEGORIES[category];
  return (
    <Card onPress={onPress} style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <AppText variant="subtitle" style={{ flex: 1 }}>
          {d.title}
        </AppText>
        <Pill label={cat.label} tone="accent" icon={cat.icon} />
      </View>
      <AppText variant="caption">{format(new Date(log.loggedAt), 'd MMM yyyy')}</AppText>
      {d.note ? (
        <AppText variant="bodyMuted" numberOfLines={2}>
          {d.note}
        </AppText>
      ) : null}
      {d.files.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginTop: t.spacing.xs }}>
          {d.files.slice(0, 4).map((f) => (
            <PhotoThumb key={f.path} file={f} size={56} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** An unmarked catalog milestone: muted, tappable to record. */
function UnrecordedRow({
  milestone,
  currentWeek,
  onMark,
}: {
  milestone: Milestone;
  currentWeek: number | null;
  onMark: () => void;
}) {
  const t = useTheme();
  const range = weekRangeLabel(milestone);
  const aroundNow =
    currentWeek != null &&
    milestone.weekFrom != null &&
    currentWeek >= milestone.weekFrom &&
    currentWeek <= (milestone.weekTo ?? milestone.weekFrom);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mark ${milestone.title}`}
      onPress={onMark}
      style={{
        borderWidth: 1.5,
        borderColor: aroundNow ? t.colors.accent : t.colors.border,
        borderStyle: 'dashed',
        borderRadius: t.radius.lg,
        backgroundColor: aroundNow ? t.colors.accentSoft : 'transparent',
        padding: t.spacing.md,
        gap: 4,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Ionicons name={milestone.icon} size={18} color={t.colors.accent} />
        <AppText variant="body" weight="bold" style={{ flex: 1 }} color={t.colors.textSecondary}>
          {milestone.title}
        </AppText>
        <Ionicons name="add-circle-outline" size={20} color={t.colors.accent} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginLeft: 18 + t.spacing.sm }}>
        {range ? (
          <AppText variant="caption" color={t.colors.textTertiary}>
            {range}
          </AppText>
        ) : null}
        {aroundNow ? <Pill label="Around now" tone="accent" icon="time-outline" /> : null}
      </View>
    </Pressable>
  );
}

/** A stored photo thumbnail loaded via a short-lived signed URL; taps open it full-screen. */
function PhotoThumb({ file, size, onRemove }: { file: TestFileRef; size: number; onRemove?: () => void }) {
  const t = useTheme();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // signedFileUrl resolves after a bounded network call; not a cascading render.
    signedFileUrl(file.path).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [file.path]);

  async function open() {
    const u = url ?? (await signedFileUrl(file.path));
    if (!u) {
      Alert.alert('Could not open photo', 'Please check your connection and try again.');
      return;
    }
    setUrl(u);
    await WebBrowser.openBrowserAsync(u);
  }

  return (
    <View style={{ position: 'relative' }}>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={file.name} onPress={open}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: t.radius.md,
            backgroundColor: t.colors.surfaceMuted,
            borderWidth: 1,
            borderColor: t.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
          {url ? (
            <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Ionicons name="image-outline" size={20} color={t.colors.textTertiary} />
          )}
        </View>
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${file.name}`}
          hitSlop={8}
          onPress={onRemove}
          style={{ position: 'absolute', top: -8, right: -8, backgroundColor: t.colors.surface, borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.colors.border }}>
          <Ionicons name="close-circle" size={22} color={t.colors.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/** Read-only detail of a recorded milestone, with Edit / Remove. */
function JourneyDetail({
  log,
  edd,
  onBack,
  onEdit,
  onDelete,
}: {
  log: CareLog<JourneyData>;
  edd: Date | null;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const d = log.data;
  const cat = JOURNEY_CATEGORIES[d.category];
  const week = weekOf(edd, log.loggedAt);

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
          Milestone
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove milestone" hitSlop={10} onPress={onDelete}>
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
        <View style={{ gap: t.spacing.sm }}>
          <AppText variant="display">{d.title}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' }}>
            <Pill label={cat.label} tone="accent" icon={cat.icon} />
            {week != null ? <Pill label={`Week ${week}`} tone="neutral" icon="calendar-outline" /> : null}
          </View>
          <AppText variant="bodyMuted">{format(new Date(log.loggedAt), 'EEEE, d MMMM yyyy')}</AppText>
        </View>

        {d.note ? (
          <Card style={{ gap: t.spacing.sm }}>
            <AppText variant="label">NOTE</AppText>
            <AppText variant="body">{d.note}</AppText>
          </Card>
        ) : null}

        {d.files.length ? (
          <Card style={{ gap: t.spacing.md }}>
            <AppText variant="label">PHOTOS</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {d.files.map((f) => (
                <PhotoThumb key={f.path} file={f} size={100} />
              ))}
            </View>
          </Card>
        ) : null}

        <Button label="Edit milestone" variant="secondary" icon="create-outline" onPress={onEdit} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a catalog milestone, add a custom event, or edit a recorded one. The title & category
 * are fixed for catalog milestones (shown as a header) and editable for custom events. Photos
 * reuse the camera/library flow and the PendingFile → uploadCareFile path from
 * src/care/physical/TestResultsLogger.tsx.
 */
function JourneyMilestoneForm({
  userId,
  existing,
  milestone,
  custom,
  onCancel,
  onSaved,
}: {
  userId: string;
  existing?: CareLog<JourneyData>;
  milestone?: Milestone;
  custom?: boolean;
  onCancel: () => void;
  onSaved: (log: CareLog<JourneyData>) => void;
}) {
  const t = useTheme();

  // The milestone identity: editing keeps the row's milestoneId; marking a catalog entry uses
  // its id; a custom event is null.
  const milestoneId = existing ? existing.data.milestoneId : milestone ? milestone.id : null;
  // Title/category are editable only for custom events (no catalog milestone backing them).
  const editable = existing ? existing.data.milestoneId === null : !!custom;
  const fixedMilestone = existing && existing.data.milestoneId ? milestoneById(existing.data.milestoneId) : milestone;

  const [title, setTitle] = useState(existing?.data.title ?? milestone?.title ?? '');
  const [category, setCategory] = useState<JourneyCategory>(
    existing?.data.category ?? milestone?.category ?? 'beginning',
  );
  const [note, setNote] = useState(existing?.data.note ?? '');
  const [date, setDate] = useState<Date>(existing ? new Date(existing.loggedAt) : new Date());
  const [existingFiles, setExistingFiles] = useState<TestFileRef[]>(existing?.data.files ?? []);
  const [newFiles, setNewFiles] = useState<PendingFile[]>([]);
  const [titleError, setTitleError] = useState('');
  const [saving, setSaving] = useState(false);

  const originalFiles = existing?.data.files ?? [];
  const headerTitle = existing ? 'Edit milestone' : editable ? 'Add a milestone' : (fixedMilestone?.title ?? 'Mark milestone');

  function addFile(f: PendingFile) {
    setNewFiles((prev) => [...prev, f]);
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings to take a photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    addFile({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', kind: 'image', size: a.fileSize });
  }

  async function choosePhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Enable photo access in Settings to choose a photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    addFile({ uri: a.uri, name: a.fileName ?? `image-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', kind: 'image', size: a.fileSize });
  }

  async function save() {
    if (saving) return;
    const cleanTitle = title.trim();
    if (editable && !cleanTitle) {
      setTitleError('Please name this milestone');
      return;
    }
    setTitleError('');
    setSaving(true);
    try {
      const uploaded: TestFileRef[] = [];
      for (const f of newFiles) uploaded.push(await uploadCareFile(userId, f));
      const payload: JourneyData = {
        kind: 'journey',
        milestoneId,
        title: cleanTitle || fixedMilestone?.title || 'Milestone',
        category,
        note: note.trim() || undefined,
        files: [...existingFiles, ...uploaded],
      };
      const log = existing
        ? await updateJourney(existing.id, payload, date)
        : await addJourney(userId, payload, date);
      // Best-effort: clean up photos dropped during an edit (the row is already saved).
      const removed = originalFiles.filter((o) => !existingFiles.some((e) => e.path === o.path));
      if (removed.length) void removeCareFiles(removed.map((f) => f.path));
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
          <AppText variant="subtitle" style={{ flex: 1 }}>
            {headerTitle}
          </AppText>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {!editable && fixedMilestone ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: t.radius.md,
                  backgroundColor: t.colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={fixedMilestone.icon} size={22} color={t.colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="subtitle">{fixedMilestone.title}</AppText>
                <Pill label={JOURNEY_CATEGORIES[category].label} tone="accent" icon={JOURNEY_CATEGORIES[category].icon} />
              </View>
            </Card>
          ) : (
            <Card style={{ gap: t.spacing.lg }}>
              <Field
                label="Milestone"
                placeholder="e.g. First swimming class"
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (titleError) setTitleError('');
                }}
                error={titleError}
              />
              <ChipSelect
                label="Category"
                options={CATEGORY_ORDER.map((c) => JOURNEY_CATEGORIES[c].label)}
                value={[JOURNEY_CATEGORIES[category].label]}
                onChange={(next) => {
                  const found = CATEGORY_ORDER.find((c) => JOURNEY_CATEGORIES[c].label === next[0]);
                  if (found) setCategory(found);
                }}
              />
            </Card>
          )}

          <Card style={{ gap: t.spacing.lg }}>
            <DateField label="When did this happen?" mode="datetime" value={date} onChange={setDate} maximumDate={new Date()} />
            <Field
              label="Note (optional)"
              placeholder="How it felt, who was there, what you want to remember…"
              value={note}
              onChangeText={setNote}
              multiline
            />
          </Card>

          <Card style={{ gap: t.spacing.md }}>
            <AppText variant="label">PHOTOS (OPTIONAL)</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              <Button label="Take photo" variant="secondary" icon="camera-outline" onPress={takePhoto} style={{ flexGrow: 1 }} />
              <Button label="Choose photo" variant="secondary" icon="images-outline" onPress={choosePhoto} style={{ flexGrow: 1 }} />
            </View>

            {existingFiles.length || newFiles.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {existingFiles.map((f) => (
                  <PhotoThumb
                    key={f.path}
                    file={f}
                    size={72}
                    onRemove={() => setExistingFiles((prev) => prev.filter((x) => x.path !== f.path))}
                  />
                ))}
                {newFiles.map((f) => (
                  <View key={f.uri} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: f.uri }}
                      style={{ width: 72, height: 72, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border }}
                      contentFit="cover"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${f.name}`}
                      hitSlop={8}
                      onPress={() => setNewFiles((prev) => prev.filter((x) => x.uri !== f.uri))}
                      style={{ position: 'absolute', top: -8, right: -8, backgroundColor: t.colors.surface, borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.colors.border }}>
                      <Ionicons name="close-circle" size={22} color={t.colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg }}>
          <Button label={saving ? 'Saving…' : 'Save milestone'} icon="checkmark" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
