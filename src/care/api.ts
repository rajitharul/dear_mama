import { format } from 'date-fns';
import { File } from 'expo-file-system';

import { loadLogCache, saveLogCache } from '@/care/cache';
import { supabase } from '@/lib/supabase';

export type LogType = 'vital' | 'symptom' | 'actionable' | 'test_result' | 'mood' | 'baby_note';

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
export type MoodData = { kind: 'mood'; rating: MoodRating; note?: string };

// ─── Note to the baby payload (Emotional care) ───
// A small free-text note to the baby, day by day — a keepsake. `logged_at` is the
// moment it's written (the UI lets you pick the day).
export type BabyNoteData = { kind: 'baby_note'; text: string };

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

export type CareLogData = VitalData | SymptomData | ActionableData | TestResultData | MoodData | BabyNoteData;

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

/** Returns both item definitions and completion checks (split in the UI). */
export const listActionables = () => listLogs<ActionableData>('actionable');
export const addActionableItem = (userId: string, item: Omit<ActionableItemData, 'kind'>) =>
  addLog<ActionableData>(userId, 'actionable', { kind: 'actionable_item', ...item }, new Date());
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
