import { supabase } from '@/lib/supabase';
import { emptyOnboarding, type CareTeamRole, type OnboardingData } from '@/onboarding/types';
import { saveCache } from '@/storage/profile';

type ProfileRow = {
  user_id: string;
  display_name: string;
  age: number | null;
  date_mode: 'edd' | 'lmp';
  due_or_lmp_date: string | null;
  date_source: 'doctor' | 'self' | null;
  due_date_doctor: string | null;
  baby_count: number;
  blood_type: string | null;
  conditions: string[];
  allergies: string[];
  medications: string[];
  prior_pregnancies: number | null;
  medical_notes: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_relation: string | null;
  care_role: CareTeamRole;
  care_name: string | null;
  care_phone: string | null;
  care_clinic: string | null;
};

const intOrNull = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};
const trimOrNull = (s: string): string | null => (s.trim() ? s.trim() : null);

function toRow(userId: string, d: OnboardingData): ProfileRow {
  const count = Math.min(4, Math.max(1, parseInt(d.babyCount, 10) || 1));
  return {
    user_id: userId,
    display_name: d.displayName.trim() || 'Mama',
    age: intOrNull(d.age),
    date_mode: d.dateMode,
    due_or_lmp_date: d.date,
    date_source: d.dateSource,
    due_date_doctor: trimOrNull(d.dueDateDoctor),
    baby_count: count,
    blood_type: trimOrNull(d.bloodType),
    conditions: d.conditions,
    allergies: d.allergies,
    medications: d.medications,
    prior_pregnancies: intOrNull(d.priorPregnancies),
    medical_notes: trimOrNull(d.medicalNotes),
    emergency_name: trimOrNull(d.emergencyName),
    emergency_phone: trimOrNull(d.emergencyPhone),
    emergency_relation: trimOrNull(d.emergencyRelation),
    care_role: d.careRole,
    care_name: trimOrNull(d.careName),
    care_phone: trimOrNull(d.carePhone),
    care_clinic: trimOrNull(d.careClinic),
  };
}

function fromRow(r: ProfileRow): OnboardingData {
  return {
    ...emptyOnboarding,
    displayName: r.display_name ?? '',
    age: r.age == null ? '' : String(r.age),
    dateMode: r.date_mode ?? 'edd',
    date: r.due_or_lmp_date ?? null,
    dateSource: r.date_source ?? null,
    dueDateDoctor: r.due_date_doctor ?? '',
    babyCount: String(r.baby_count ?? 1),
    bloodType: r.blood_type ?? '',
    conditions: r.conditions ?? [],
    allergies: r.allergies ?? [],
    medications: r.medications ?? [],
    priorPregnancies: r.prior_pregnancies == null ? '' : String(r.prior_pregnancies),
    medicalNotes: r.medical_notes ?? '',
    emergencyName: r.emergency_name ?? '',
    emergencyPhone: r.emergency_phone ?? '',
    emergencyRelation: r.emergency_relation ?? '',
    careRole: r.care_role ?? 'ob',
    careName: r.care_name ?? '',
    carePhone: r.care_phone ?? '',
    careClinic: r.care_clinic ?? '',
  };
}

/** Fetch the signed-in user's profile (null if they haven't onboarded). Bounded by a timeout. */
export async function loadProfile(): Promise<OnboardingData | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .abortSignal(AbortSignal.timeout(8000))
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const mapped = fromRow(data as ProfileRow);
  saveCache(mapped); // keep the offline mirror fresh
  return mapped;
}

/** Create/update the signed-in user's profile. */
export async function saveProfile(userId: string, data: OnboardingData): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ ...toRow(userId, data), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .abortSignal(AbortSignal.timeout(10000));
  if (error) throw error;
  saveCache(data);
}
