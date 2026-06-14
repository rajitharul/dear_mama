import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyOnboarding, type OnboardingData } from '@/onboarding/types';

// Local mirror of the user's profile — used for instant render and as an
// offline fallback when Supabase is unreachable. Supabase is the source of truth.
const KEY = 'dearmama.profile.cache.v1';

export async function loadCache(): Promise<OnboardingData | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return { ...emptyOnboarding, ...(JSON.parse(raw) as Partial<OnboardingData>) };
  } catch {
    return null;
  }
}

export async function saveCache(data: OnboardingData): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore cache write failures
  }
}

export async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
