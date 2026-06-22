import { format } from 'date-fns';
import { File } from 'expo-file-system';

import { loadLogCache, saveLogCache } from '@/care/cache';
import { supabase } from '@/lib/supabase';

export type LogType =
  | 'vital'
  | 'symptom'
  | 'actionable'
  | 'test_result'
  | 'mood'
  | 'baby_note'
  | 'rest'
  | 'kick'
  | 'movement'
  | 'contraction'
  | 'visit'
  | 'journey';

// ─── Vital payloads (discriminated by `kind`, stored in `care_logs.data` jsonb) ───
export type WeightUnit = 'kg' | 'lb';
export type GlucoseUnit = 'mmol/L' | 'mg/dL';
export type GlucoseContext = 'fasting' | 'post_meal' | 'random';

export type BpData = { kind: 'bp'; systolic: number; diastolic: number; pulse?: number; note?: string };
export type WeightData = { kind: 'weight'; value: number; unit: WeightUnit; note?: string };
export type BloodSugarData = {
  kind: 'blood_sugar';
  value: number;
  unit: GlucoseUnit;
  context: GlucoseContext;
  note?: string;
};
export type VitalData = BpData | WeightData | BloodSugarData;
export type VitalKind = VitalData['kind'];

// ─── Symptom payload ───
export type SymptomSeverity = 'mild' | 'moderate' | 'severe';
export type SymptomData = { kind: 'symptom'; symptom: string; severity: SymptomSeverity; note?: string };

// ─── Mood payload (Emotional care) ───
// A check-in: a single mood pick on a 1–5 scale (1 = very low … 5 = very good),
// each presented with an emoji, plus an optional free-text note. A future iteration
// will attach an AI-powered supportive message to the check-in.
export type MoodRating = 1 | 2 | 3 | 4 | 5;
export type MoodData = { kind: 'mood'; rating: MoodRating; note?: string; files?: TestFileRef[] };

// ─── Note to the baby payload (Emotional care) ───
// A small free-text note to the baby, day by day — a keepsake. `logged_at` is the
// moment it's written (the UI lets you pick the day).
export type BabyNoteData = { kind: 'baby_note'; text: string };

// ─── Rest & sleep payload (Physical care) ───
// One night's rest: hours slept (decimal), a sleep-quality rating, and an optional note.
// FUTURE: where available, `hours` (and possibly quality) can be auto-imported from
// Apple Health (HealthKit) / Google Health (Health Connect) instead of manual entry —
// keep this payload shape source-agnostic so synced and hand-entered nights look alike.
export type RestQuality = 'restless' | 'okay' | 'restful';
export type RestData = { kind: 'rest'; hours: number; quality: RestQuality; note?: string };

// ─── Fetal: kicks & movements (Fetal care) ───
// Clinically a "kick" (a sharp, countable jab) and a "movement" (a roll, flutter, hiccup,
// turn…) are different, and they're modelled differently:
//  • 'kick'     — a counting session: how many kicks were felt, how long it took (minutes),
//    and an optional note. `logged_at` is the session start. The ~10 guideline is a gentle
//    goal; the count is open-ended.
//  • 'movement' — a single observation: what kind of movement (a free-text label chosen from
//    a list or typed as "other") plus an optional note. Not counted, no session.
export type KickData = { kind: 'kick'; count: number; durationMin: number; note?: string };
export type MovementData = { kind: 'movement'; movement: string; note?: string };

// ─── Contractions (Physical care) ───
// One timing *session*: each contraction's start + how long it lasted. The app derives the gap
// between starts (frequency). `type` tags the session as practice (Braxton Hicks) or labor;
// irregular vs regular intervals reveal the difference either way. One session = one care_logs row.
export type ContractionType = 'braxton_hicks' | 'labor';
export type ContractionEntry = { startedAt: string; durationSec: number }; // ISO start, length in s
export type ContractionData = {
  kind: 'contraction';
  type?: ContractionType; // optional session tag
  entries: ContractionEntry[]; // each timed contraction, in order
  count: number; // entries.length (denormalized for the list summary)
  avgDurationSec: number; // mean entry duration
  avgIntervalSec: number; // mean gap between consecutive starts (0 if < 2 entries)
  note?: string;
};

// ─── Visits (antenatal appointments) ───
// One self-contained record per visit. `logged_at` is the visit's date & time; a future
// `logged_at` means an *upcoming* appointment (the status is derived from the date, not
// stored). For an upcoming visit only place/doctor/date + prerequisites are filled in;
// the doctor's notes, prescription, tests and routines are added later by editing it once
// the visit has happened. Each prescription/test/routine line is just recorded free text.
export type VisitData = {
  kind: 'visit';
  place: string; // clinic / hospital / doctor's office
  doctor?: string; // who you saw
  notes?: string; // doctor's notes from this visit
  prerequisites?: string; // things to prepare/bring for the next visit
  medicines: string[]; // prescription — medicine (e.g. "Iron 65mg — daily")
  supplements: string[]; // prescription — supplements (e.g. "Folic acid — daily")
  tests: string[]; // tests / scans ordered (e.g. "Anomaly scan")
  routines: string[]; // routines / actionables (e.g. "30 min walk daily")
};

// ─── Journey (pregnancy milestone timeline) ───
// A milestone the user has marked as it happened. The curated template of milestones lives
// in app code (src/care/journey/milestones.ts); a recorded milestone is one care_logs row
// with `logged_at` = when it happened. `milestoneId` points at a catalog entry, or is null
// for a user-added custom event. `title`/`category` are copied onto the row so the timeline
// can render custom events (and stay readable if the catalog later changes). Photos reuse the
// 'care-files' bucket (only the object path is stored — see TestFileRef/uploadCareFile).
export type JourneyCategory = 'beginning' | 'clinical' | 'baby_body' | 'prep';
export type JourneyData = {
  kind: 'journey';
  milestoneId: string | null; // catalog id, or null for a custom event
  title: string; // copied from the catalog, or the custom title
  category: JourneyCategory;
  note?: string;
  files: TestFileRef[]; // photos (may be empty)
};

// ─── Actionable payloads ───
// Two flavours share log_type='actionable', discriminated by `kind`:
//  • 'actionable_item'  — a user-defined actionable: name, what to do, how often, and a
//    (placeholder) link to a future doctor event / prescription. There are no built-in items.
//  • 'actionable_check' — one completion of an item, timestamped (logged_at/logged_date); the
//    completion model counts checks within the item's current period (honoring `frequency`).
export type ActionableFrequency = 'daily' | 'twice_daily' | 'weekly' | 'monthly' | 'as_needed';
// How an actionable is scheduled. Dates are 'yyyy-MM-dd' strings.
//  • 'repeating' — a recurring cadence, optionally bounded to an active window (from/to).
//  • 'finite'    — do it a fixed number of times (1 = one-time, 2, 3…), optionally by a deadline.
export type ActionableSchedule =
  | { type: 'repeating'; frequency: ActionableFrequency; startDate?: string; endDate?: string }
  | { type: 'finite'; targetCount: number; deadline?: string };
export type ActionableItemData = {
  kind: 'actionable_item';
  label: string; // the name
  instruction?: string; // what to do
  schedule: ActionableSchedule;
  link?: string; // placeholder — later links to a doctor event / prescription
};
export type ActionableCheckData = { kind: 'actionable_check'; itemId: string };
export type ActionableData = ActionableItemData | ActionableCheckData;

// ─── Test result payloads ───
// log_type='test_result'. Two flavours, matching the add form's toggle:
//  • 'test_attachment' — a scan / report: a title, optional note, and one or more files.
//  • 'test_value'      — a structured lab value (name + value + unit + reference range),
//    with an optional single supporting file.
// Files live in Supabase Storage (private bucket 'care-files'); only the object path is
// stored here. Previews/opens go through short-lived signed URLs (see signedFileUrl).
export type TestFileKind = 'image' | 'pdf';
export type TestFileRef = {
  path: string; // storage object path: `<uid>/<unique>.<ext>`
  name: string; // original filename, for display
  mimeType: string;
  kind: TestFileKind;
  size?: number;
};
export type TestResultData =
  | { kind: 'test_attachment'; title: string; note?: string; files: TestFileRef[] }
  | {
      kind: 'test_value';
      name: string;
      value: number;
      unit?: string;
      refLow?: number;
      refHigh?: number;
      note?: string;
      file?: TestFileRef;
    };

export type CareLogData =
  | VitalData
  | SymptomData
  | ActionableData
  | TestResultData
  | MoodData
  | BabyNoteData
  | RestData
  | KickData
  | MovementData
  | ContractionData
  | VisitData
  | JourneyData;

/** A Care log as used by the app, generic over its payload type. */
export type CareLog<T extends CareLogData = CareLogData> = {
  id: string;
  loggedAt: string; // ISO timestamp
  data: T;
};

type CareLogRow<T extends CareLogData> = {
  id: string;
  user_id: string;
  log_type: string;
  logged_at: string;
  logged_date: string;
  data: T;
};

const fromRow = <T extends CareLogData>(r: CareLogRow<T>): CareLog<T> => ({
  id: r.id,
  loggedAt: r.logged_at,
  data: r.data,
});

// Supabase's PostgrestError is a plain object (not an Error), so surface its real
// message/details instead of letting callers fall back to a generic string.
function toError(error: { message?: string; details?: string; hint?: string }): Error {
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return new Error(parts.join(' — ') || 'Request failed');
}

// ─── Generic log operations (shared by every logger) ───

/** Fetch the signed-in user's logs of a type, newest first. Bounded; refreshes the cache. */
async function listLogs<T extends CareLogData>(logType: LogType): Promise<CareLog<T>[]> {
  const { data, error } = await supabase
    .from('care_logs')
    .select('*')
    .eq('log_type', logType)
    .order('logged_at', { ascending: false })
    .abortSignal(AbortSignal.timeout(8000));
  if (error) throw toError(error);
  const logs = (data as CareLogRow<T>[]).map(fromRow);
  saveLogCache(logType, logs); // keep the offline mirror fresh
  return logs;
}

/** Insert a new log and return it. Updates the offline cache on success. */
async function addLog<T extends CareLogData>(
  userId: string,
  logType: LogType,
  payload: T,
  loggedAt: Date,
): Promise<CareLog<T>> {
  const { data, error } = await supabase
    .from('care_logs')
    .insert({
      user_id: userId,
      log_type: logType,
      logged_at: loggedAt.toISOString(),
      logged_date: format(loggedAt, 'yyyy-MM-dd'),
      data: payload,
    })
    .select()
    .abortSignal(AbortSignal.timeout(10000))
    .single();
  if (error) throw toError(error);
  const log = fromRow(data as CareLogRow<T>);
  const cached = await loadLogCache<T>(logType);
  saveLogCache(logType, [log, ...cached]);
  return log;
}

/** Update a log's payload + timestamp. Refreshes the offline cache for its type on success. */
export async function updateLog<T extends CareLogData>(
  id: string,
  logType: LogType,
  payload: T,
  loggedAt: Date,
): Promise<CareLog<T>> {
  const { data, error } = await supabase
    .from('care_logs')
    .update({
      data: payload,
      logged_at: loggedAt.toISOString(),
      logged_date: format(loggedAt, 'yyyy-MM-dd'),
    })
    .eq('id', id)
    .select()
    .abortSignal(AbortSignal.timeout(10000))
    .single();
  if (error) throw toError(error);
  const log = fromRow(data as CareLogRow<T>);
  const cached = await loadLogCache<T>(logType);
  saveLogCache(
    logType,
    cached.map((l) => (l.id === id ? log : l)),
  );
  return log;
}

/** Delete a log by id. Updates the offline cache for its type on success. */
export async function deleteLog(id: string, logType: LogType): Promise<void> {
  const { error } = await supabase
    .from('care_logs')
    .delete()
    .eq('id', id)
    .abortSignal(AbortSignal.timeout(10000));
  if (error) throw toError(error);
  const cached = await loadLogCache(logType);
  saveLogCache(
    logType,
    cached.filter((l) => l.id !== id),
  );
}

// ─── Per-feature wrappers ───
export const listVitals = () => listLogs<VitalData>('vital');
export const addVital = (userId: string, payload: VitalData, loggedAt: Date) =>
  addLog(userId, 'vital', payload, loggedAt);

export const listSymptoms = () => listLogs<SymptomData>('symptom');
export const addSymptom = (userId: string, payload: SymptomData, loggedAt: Date) =>
  addLog(userId, 'symptom', payload, loggedAt);

export const listMoods = () => listLogs<MoodData>('mood');
export const addMood = (userId: string, payload: MoodData, loggedAt: Date) =>
  addLog(userId, 'mood', payload, loggedAt);

export const listBabyNotes = () => listLogs<BabyNoteData>('baby_note');
export const addBabyNote = (userId: string, payload: BabyNoteData, loggedAt: Date) =>
  addLog(userId, 'baby_note', payload, loggedAt);

export const listRest = () => listLogs<RestData>('rest');
export const addRest = (userId: string, payload: RestData, loggedAt: Date) =>
  addLog(userId, 'rest', payload, loggedAt);

export const listKicks = () => listLogs<KickData>('kick');
export const addKick = (userId: string, payload: KickData, loggedAt: Date) =>
  addLog(userId, 'kick', payload, loggedAt);

export const listMovements = () => listLogs<MovementData>('movement');
export const addMovement = (userId: string, payload: MovementData, loggedAt: Date) =>
  addLog(userId, 'movement', payload, loggedAt);

export const listContractions = () => listLogs<ContractionData>('contraction');
export const addContraction = (userId: string, payload: ContractionData, loggedAt: Date) =>
  addLog(userId, 'contraction', payload, loggedAt);

export const listVisits = () => listLogs<VisitData>('visit');
export const addVisit = (userId: string, payload: VisitData, loggedAt: Date) =>
  addLog(userId, 'visit', payload, loggedAt);
export const updateVisit = (id: string, payload: VisitData, loggedAt: Date) =>
  updateLog(id, 'visit', payload, loggedAt);

export const listJourney = () => listLogs<JourneyData>('journey');
export const addJourney = (userId: string, payload: JourneyData, loggedAt: Date) =>
  addLog(userId, 'journey', payload, loggedAt);
export const updateJourney = (id: string, payload: JourneyData, loggedAt: Date) =>
  updateLog(id, 'journey', payload, loggedAt);

/** Returns both item definitions and completion checks (split in the UI). */
export const listActionables = () => listLogs<ActionableData>('actionable');
export const addActionableItem = (userId: string, item: Omit<ActionableItemData, 'kind'>) =>
  addLog<ActionableData>(userId, 'actionable', { kind: 'actionable_item', ...item }, new Date());
export const updateActionableItem = (id: string, item: Omit<ActionableItemData, 'kind'>, loggedAt: Date) =>
  updateLog<ActionableData>(id, 'actionable', { kind: 'actionable_item', ...item }, loggedAt);
export const addActionableCheck = (userId: string, itemId: string, on: Date) =>
  addLog<ActionableData>(userId, 'actionable', { kind: 'actionable_check', itemId }, on);

// ─── Test results & scans: Storage-backed files ───
const CARE_BUCKET = 'care-files';

/** A file the user picked (from the camera, photo library, or a document picker). */
export type PendingFile = { uri: string; name: string; mimeType: string; kind: TestFileKind; size?: number };

const extFromName = (name: string, mimeType: string): string => {
  const fromName = name.includes('.') ? name.split('.').pop()! : '';
  if (fromName) return fromName.toLowerCase();
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return mimeType.slice('image/'.length);
  return 'bin';
};

/** Read a picked file's bytes and upload them to the private care-files bucket. */
export async function uploadCareFile(userId: string, file: PendingFile): Promise<TestFileRef> {
  const bytes = await new File(file.uri).bytes(); // local read, no network
  const path = `${userId}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${extFromName(file.name, file.mimeType)}`;
  const { error } = await supabase.storage
    .from(CARE_BUCKET)
    .upload(path, bytes, { contentType: file.mimeType, upsert: false });
  if (error) throw toError(error);
  return { path, name: file.name, mimeType: file.mimeType, kind: file.kind, size: file.size };
}

/**
 * A short-lived signed URL for a private object, for previewing/opening. Bounded so a
 * stalled request never hangs a thumbnail; returns null on failure (UI shows a placeholder).
 */
export async function signedFileUrl(path: string, expiresIn = 3600): Promise<string | null> {
  try {
    const result = await Promise.race([
      supabase.storage.from(CARE_BUCKET).createSignedUrl(path, expiresIn),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
    if (result.error) return null;
    return result.data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** Best-effort removal of objects from the care-files bucket (bounded). */
export async function removeCareFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  try {
    await Promise.race([
      supabase.storage.from(CARE_BUCKET).remove(paths),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
    ]);
  } catch {
    // Leaving an orphaned object behind is harmless (owner-scoped); don't block the delete.
  }
}

export const listTestResults = () => listLogs<TestResultData>('test_result');
export const addTestResult = (userId: string, data: TestResultData, loggedAt: Date) =>
  addLog<TestResultData>(userId, 'test_result', data, loggedAt);
