import { format } from 'date-fns';

import { loadVitalsCache, saveVitalsCache } from '@/care/cache';
import { supabase } from '@/lib/supabase';

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

/** A Care log as used by the app (currently only vitals). */
export type CareLog = {
  id: string;
  loggedAt: string; // ISO timestamp
  data: VitalData;
};

type CareLogRow = {
  id: string;
  user_id: string;
  log_type: string;
  logged_at: string;
  logged_date: string;
  data: VitalData;
};

const fromRow = (r: CareLogRow): CareLog => ({ id: r.id, loggedAt: r.logged_at, data: r.data });

// Supabase's PostgrestError is a plain object (not an Error), so surface its real
// message/details instead of letting callers fall back to a generic string.
function toError(error: { message?: string; details?: string; hint?: string }): Error {
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return new Error(parts.join(' — ') || 'Request failed');
}

/** Fetch the signed-in user's vital logs, newest first. Bounded by a timeout; refreshes the cache. */
export async function listVitals(): Promise<CareLog[]> {
  const { data, error } = await supabase
    .from('care_logs')
    .select('*')
    .eq('log_type', 'vital')
    .order('logged_at', { ascending: false })
    .abortSignal(AbortSignal.timeout(8000));
  if (error) throw toError(error);
  const logs = (data as CareLogRow[]).map(fromRow);
  saveVitalsCache(logs); // keep the offline mirror fresh
  return logs;
}

/** Insert a new vital reading and return it. Updates the offline cache on success. */
export async function addVital(userId: string, payload: VitalData, loggedAt: Date): Promise<CareLog> {
  const { data, error } = await supabase
    .from('care_logs')
    .insert({
      user_id: userId,
      log_type: 'vital',
      logged_at: loggedAt.toISOString(),
      logged_date: format(loggedAt, 'yyyy-MM-dd'),
      data: payload,
    })
    .select()
    .abortSignal(AbortSignal.timeout(10000))
    .single();
  if (error) throw toError(error);
  const log = fromRow(data as CareLogRow);
  const cached = await loadVitalsCache();
  saveVitalsCache([log, ...cached]);
  return log;
}

/** Delete a log by id. Updates the offline cache on success. */
export async function deleteLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('care_logs')
    .delete()
    .eq('id', id)
    .abortSignal(AbortSignal.timeout(10000));
  if (error) throw toError(error);
  const cached = await loadVitalsCache();
  saveVitalsCache(cached.filter((l) => l.id !== id));
}
