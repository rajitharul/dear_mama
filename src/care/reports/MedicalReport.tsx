import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listSymptoms,
  listTestResults,
  listVitals,
  listVisits,
  signedFileUrl,
  type CareLog,
  type CareLogData,
  type ExerciseIntensity,
  type GlucoseContext,
  type LogType,
  type MealKind,
  type SymptomData,
  type SymptomSeverity,
  type TestFileRef,
  type TestResultData,
  type VisitData,
  type VitalData,
} from '@/care/api';
import { loadLogCache } from '@/care/cache';
import { useTheme } from '@/theme';
import { AppText, calmRise, Card, OrganicBackdrop, Pill } from '@/ui';

// How many of each physical-care log to show under its section (newest first).
const RECENT_LIMIT = 5;

// ── Vitals: one-line summary (mirrors VitalsLogger's summarize, kept local so this read-only
//    screen stays self-contained and the logger is untouched). ──
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

function summarizeVital(d: VitalData): { icon: keyof typeof Ionicons.glyphMap; title: string; value: string } {
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

// ── Test results: reference-range helpers (mirror TestResultsLogger). ──
const fileRefsOf = (d: TestResultData): TestFileRef[] =>
  d.kind === 'test_attachment' ? d.files : d.file ? [d.file] : [];

function rangeStatus(d: Extract<TestResultData, { kind: 'test_value' }>):
  | { label: string; tone: 'success' | 'danger' }
  | null {
  if (typeof d.refLow !== 'number' && typeof d.refHigh !== 'number') return null;
  if (typeof d.refLow === 'number' && d.value < d.refLow) return { label: 'Below range', tone: 'danger' };
  if (typeof d.refHigh === 'number' && d.value > d.refHigh) return { label: 'Above range', tone: 'danger' };
  return { label: 'In range', tone: 'success' };
}

const rangeText = (d: Extract<TestResultData, { kind: 'test_value' }>): string | null => {
  if (typeof d.refLow === 'number' && typeof d.refHigh === 'number') return `Ref ${d.refLow}–${d.refHigh}`;
  if (typeof d.refLow === 'number') return `Ref ≥ ${d.refLow}`;
  if (typeof d.refHigh === 'number') return `Ref ≤ ${d.refHigh}`;
  return null;
};

// ── Symptoms: severity → label + tone (mirror SymptomsLogger). ──
const SEVERITY: Record<SymptomSeverity, { label: string; tone: 'success' | 'accent' | 'danger' }> = {
  mild: { label: 'Mild', tone: 'success' },
  moderate: { label: 'Moderate', tone: 'accent' },
  severe: { label: 'Severe', tone: 'danger' },
};

/** Fetch a log type, falling back to the offline cache if the network request fails. */
async function fetchWithCache<T extends CareLogData>(
  fetcher: () => Promise<CareLog<T>[]>,
  type: LogType,
): Promise<{ logs: CareLog<T>[]; stale: boolean }> {
  try {
    return { logs: await fetcher(), stale: false };
  } catch {
    return { logs: await loadLogCache<T>(type), stale: true };
  }
}

/**
 * Medical report (Care pillar): a calm, read-only summary of what's already been recorded —
 * the most recent past appointment in full, then the recent vitals, test results & scans, and
 * symptoms. It reads existing care_logs; it never records or edits anything.
 */
export function MedicalReport({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [latestVisit, setLatestVisit] = useState<CareLog<VisitData> | null>(null);
  const [vitals, setVitals] = useState<CareLog<VitalData>[]>([]);
  const [tests, setTests] = useState<CareLog<TestResultData>[]>([]);
  const [symptoms, setSymptoms] = useState<CareLog<SymptomData>[]>([]);

  const load = useCallback(async () => {
    const now = Date.now();
    const [v, vit, ts, sy] = await Promise.all([
      fetchWithCache(listVisits, 'visit'),
      fetchWithCache(listVitals, 'vital'),
      fetchWithCache(listTestResults, 'test_result'),
      fetchWithCache(listSymptoms, 'symptom'),
    ]);
    // The latest *past* visit — upcoming appointments have no diagnosis yet. Lists are newest-first.
    const pastVisits = v.logs.filter((l) => new Date(l.loggedAt).getTime() <= now);
    setLatestVisit(pastVisits[0] ?? null);
    setVitals(vit.logs.slice(0, RECENT_LIMIT));
    setTests(ts.logs.slice(0, RECENT_LIMIT));
    setSymptoms(sy.logs.slice(0, RECENT_LIMIT));
    setStale(v.stale || vit.stale || ts.stale || sy.stale);
    setLoading(false);
  }, []);

  useEffect(() => {
    // load only sets state after awaited work, so the cascading-render rule doesn't apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const entering = (delay: number) => (reduce ? undefined : calmRise(delay));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <OrganicBackdrop />
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
        <AppText variant="subtitle">Medical report</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <AppText variant="bodyMuted" style={{ maxWidth: 320 }}>
          A read-only summary of what you’ve recorded so far.
        </AppText>

        {stale ? (
          <Pill label="Showing saved records — couldn’t refresh" tone="neutral" icon="cloud-offline-outline" />
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: t.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={t.colors.accent} />
          </View>
        ) : (
          <>
            <Animated.View entering={entering(0)}>
              <Section title="LAST APPOINTMENT">
                {latestVisit ? (
                  <AppointmentCard log={latestVisit} />
                ) : (
                  <EmptyLine text="No appointments recorded yet." />
                )}
              </Section>
            </Animated.View>

            <Animated.View entering={entering(90)}>
              <Section title="VITALS & DAILY LOGS">
                {vitals.length ? (
                  vitals.map((log) => <VitalCard key={log.id} log={log} />)
                ) : (
                  <EmptyLine text="No vitals logged yet." />
                )}
              </Section>
            </Animated.View>

            <Animated.View entering={entering(160)}>
              <Section title="TEST RESULTS & SCANS">
                {tests.length ? (
                  tests.map((log) => <TestCard key={log.id} log={log} />)
                ) : (
                  <EmptyLine text="No test results or scans yet." />
                )}
              </Section>
            </Animated.View>

            <Animated.View entering={entering(230)}>
              <Section title="SYMPTOMS">
                {symptoms.length ? (
                  symptoms.map((log) => <SymptomCard key={log.id} log={log} />)
                ) : (
                  <EmptyLine text="No symptoms logged yet." />
                )}
              </Section>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.md }}>
      <AppText variant="label">{title}</AppText>
      {children}
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  const t = useTheme();
  return (
    <Card style={{ paddingVertical: t.spacing.lg }}>
      <AppText variant="bodyMuted">{text}</AppText>
    </Card>
  );
}

/** The latest past visit, shown in full (place, doctor, diagnosis, prescription, tests, routines). */
function AppointmentCard({ log }: { log: CareLog<VisitData> }) {
  const t = useTheme();
  const v = log.data;
  return (
    <Card style={{ gap: t.spacing.md }}>
      <View style={{ gap: t.spacing.xs }}>
        <AppText variant="subtitle">{v.place}</AppText>
        <AppText variant="bodyMuted">
          {format(new Date(log.loggedAt), 'EEEE, d MMM yyyy · h:mm a')}
          {v.doctor ? ` · ${v.doctor}` : ''}
        </AppText>
      </View>

      {v.notes ? (
        <View style={{ gap: t.spacing.xs }}>
          <AppText variant="label">DOCTOR’S DIAGNOSIS</AppText>
          <AppText variant="body">{v.notes}</AppText>
        </View>
      ) : null}

      {v.prerequisites ? (
        <View style={{ gap: t.spacing.xs }}>
          <AppText variant="label">PREREQUISITES FOR NEXT VISIT</AppText>
          <AppText variant="body">{v.prerequisites}</AppText>
        </View>
      ) : null}

      <ItemList title="MEDICINE" icon="medkit-outline" items={v.medicines} />
      <ItemList title="SUPPLEMENTS" icon="leaf-outline" items={v.supplements} />
      <ItemList title="TESTS / SCANS" icon="document-text-outline" items={v.tests} />
      <ItemList title="ROUTINES" icon="checkmark-done-outline" items={v.routines} />
    </Card>
  );
}

function ItemList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
}) {
  const t = useTheme();
  if (!items.length) return null;
  return (
    <View style={{ gap: t.spacing.sm }}>
      <AppText variant="label">{title}</AppText>
      {items.map((item, i) => (
        <View key={`${item}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
          <Ionicons name={icon} size={18} color={t.colors.accent} />
          <AppText variant="body" style={{ flex: 1 }}>
            {item}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function VitalCard({ log }: { log: CareLog<VitalData> }) {
  const t = useTheme();
  const s = summarizeVital(log.data);
  return (
    <Card style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <IconBadge icon={s.icon} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subtitle">{s.value}</AppText>
          <AppText variant="caption">
            {s.title} · {format(new Date(log.loggedAt), 'd MMM yyyy · h:mm a')}
          </AppText>
        </View>
      </View>
      {log.data.note ? (
        <AppText variant="bodyMuted" style={{ marginLeft: 44 + t.spacing.md }}>
          {log.data.note}
        </AppText>
      ) : null}
    </Card>
  );
}

function TestCard({ log }: { log: CareLog<TestResultData> }) {
  const t = useTheme();
  const d = log.data;
  const isValue = d.kind === 'test_value';
  const range = isValue ? rangeStatus(d) : null;
  const files = fileRefsOf(d);
  return (
    <Card style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <IconBadge icon={isValue ? 'flask-outline' : 'document-text-outline'} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="subtitle">{isValue ? d.name : d.title}</AppText>
          <AppText variant="caption">{format(new Date(log.loggedAt), 'd MMM yyyy')}</AppText>
        </View>
      </View>
      <View style={{ marginLeft: 44 + t.spacing.md, gap: t.spacing.sm }}>
        {isValue ? (
          <>
            <AppText variant="body" weight="bold">
              {d.value}
              {d.unit ? ` ${d.unit}` : ''}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, alignItems: 'center' }}>
              {range ? <Pill label={range.label} tone={range.tone} icon="pulse-outline" /> : null}
              {rangeText(d) ? <AppText variant="caption">{rangeText(d)}</AppText> : null}
            </View>
          </>
        ) : null}
        {d.note ? <AppText variant="bodyMuted">{d.note}</AppText> : null}
        {files.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, marginTop: t.spacing.xs }}>
            {files.map((f) => (
              <SavedFile key={f.path} file={f} />
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function SymptomCard({ log }: { log: CareLog<SymptomData> }) {
  const t = useTheme();
  const sev = SEVERITY[log.data.severity];
  return (
    <Card style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <IconBadge icon="medkit-outline" />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="subtitle">{log.data.symptom}</AppText>
          <AppText variant="caption">{format(new Date(log.loggedAt), 'd MMM yyyy · h:mm a')}</AppText>
        </View>
      </View>
      <View style={{ marginLeft: 44 + t.spacing.md, gap: t.spacing.sm }}>
        <Pill label={sev.label} tone={sev.tone} icon="pulse-outline" />
        {log.data.note ? <AppText variant="bodyMuted">{log.data.note}</AppText> : null}
      </View>
    </Card>
  );
}

function IconBadge({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: t.radius.md,
        backgroundColor: t.colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={22} color={t.colors.accent} />
    </View>
  );
}

/** A stored scan/report: image thumbnail (via signed URL) or a tappable PDF chip; opens in-app. */
function SavedFile({ file }: { file: TestFileRef }) {
  const t = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let active = true;
    if (file.kind === 'image') {
      // signedFileUrl resolves after a bounded network call; not a cascading render.
      signedFileUrl(file.path).then((u) => active && setUrl(u));
    }
    return () => {
      active = false;
    };
  }, [file.path, file.kind]);

  async function open() {
    if (opening) return;
    setOpening(true);
    const u = url ?? (await signedFileUrl(file.path));
    setOpening(false);
    if (!u) {
      Alert.alert('Could not open file', 'Please check your connection and try again.');
      return;
    }
    if (file.kind === 'image') setUrl(u);
    await WebBrowser.openBrowserAsync(u);
  }

  if (file.kind === 'image') {
    return (
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={file.name} onPress={open}>
        <View
          style={{
            width: 72,
            height: 72,
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
            <Ionicons name="image-outline" size={24} color={t.colors.textTertiary} />
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${file.name}`}
      onPress={open}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        backgroundColor: t.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radius.md,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
        maxWidth: 220,
      }}>
      {opening ? (
        <ActivityIndicator size="small" color={t.colors.accent} />
      ) : (
        <Ionicons name="document-attach-outline" size={16} color={t.colors.accent} />
      )}
      <AppText variant="caption" color={t.colors.text} style={{ flexShrink: 1 }} numberOfLines={1}>
        {file.name}
      </AppText>
    </Pressable>
  );
}
