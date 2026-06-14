import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CareLog } from '@/care/api';

// Local mirror of the user's Care logs — used for instant render and as an
// offline fallback when Supabase is unreachable. Supabase is the source of truth.
const VITALS_KEY = 'dearmama.carelogs.vitals.v1';

export async function loadVitalsCache(): Promise<CareLog[]> {
  try {
    const raw = await AsyncStorage.getItem(VITALS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CareLog[];
  } catch {
    return [];
  }
}

export async function saveVitalsCache(logs: CareLog[]): Promise<void> {
  try {
    await AsyncStorage.setItem(VITALS_KEY, JSON.stringify(logs));
  } catch {
    // ignore cache write failures
  }
}

/** Clear all Care log caches (called on sign-out alongside the profile cache). */
export async function clearCareCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(VITALS_KEY);
  } catch {
    // ignore
  }
}
