import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CareLog, CareLogData, LogType } from '@/care/api';

// Local mirror of the user's Care logs, one bucket per log type — used for instant
// render and as an offline fallback when Supabase is unreachable. Supabase is the
// source of truth.
const ALL_TYPES: LogType[] = ['vital', 'symptom', 'actionable', 'test_result', 'mood', 'baby_note', 'rest'];
const key = (type: LogType) => `dearmama.carelogs.${type}.v1`;

export async function loadLogCache<T extends CareLogData>(type: LogType): Promise<CareLog<T>[]> {
  try {
    const raw = await AsyncStorage.getItem(key(type));
    if (!raw) return [];
    return JSON.parse(raw) as CareLog<T>[];
  } catch {
    return [];
  }
}

export async function saveLogCache(type: LogType, logs: CareLog[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(type), JSON.stringify(logs));
  } catch {
    // ignore cache write failures
  }
}

/** Clear all Care log caches (called on sign-out alongside the profile cache). */
export async function clearCareCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(ALL_TYPES.map(key));
  } catch {
    // ignore
  }
}
