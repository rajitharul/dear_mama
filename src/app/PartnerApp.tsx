import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppTabs } from '@/app/AppTabs';
import type { OnboardingData } from '@/onboarding/types';
import { loadProfile, saveProfile } from '@/profile/api';
import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

/**
 * The partner experience: no onboarding — the same app shell the mother sees, but `audience`
 * filters the navigation to the tabs a partner can access (Care + Profile). Every read/write
 * flows through the mother's `userId`, so the existing loggers operate directly on her record
 * (the broadened RLS permits it).
 */
export function PartnerApp({ motherId, onSignOut }: { motherId: string; onSignOut: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [profile, setProfile] = useState<OnboardingData | null>(null);

  // Mirrors the gate in app/index.tsx: only set state after an awaited fetch. A null profile
  // here means access was revoked (or the link is gone) — RLS no longer exposes her row.
  const loadInto = useCallback(async () => {
    try {
      const p = await loadProfile(motherId);
      if (p) {
        setProfile(p);
        setState('ready');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }, [motherId]);

  const retry = useCallback(() => {
    setState('loading');
    void loadInto();
  }, [loadInto]);

  useEffect(() => {
    // loadInto only sets state after an awaited fetch (never synchronously).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInto();
  }, [loadInto]);

  const saveMotherProfile = useCallback(
    async (d: OnboardingData) => {
      await saveProfile(motherId, d);
      setProfile(d);
    },
    [motherId],
  );

  if (state === 'loading') return <Splash />;
  if (state === 'error' || !profile) return <NoAccess onRetry={retry} onSignOut={onSignOut} />;

  return (
    <AppTabs
      data={profile}
      userId={motherId}
      onSaveProfile={saveMotherProfile}
      onSignOut={onSignOut}
      audience="partner"
    />
  );
}

function Splash() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.lg, backgroundColor: t.colors.background }}>
      <AppText variant="display" color={t.colors.accent}>
        DearMama
      </AppText>
      <ActivityIndicator color={t.colors.accent} />
    </View>
  );
}

function NoAccess({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.lg, padding: t.spacing.xl, backgroundColor: t.colors.background }}>
      <AppText variant="title" center>
        No access yet
      </AppText>
      <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
        We couldn’t load this care space. Your access may not be set up yet, or it was removed.
        Check your connection and try again.
      </AppText>
      <View style={{ alignSelf: 'stretch', gap: t.spacing.sm }}>
        <Button label="Try again" icon="refresh" onPress={onRetry} />
        <Button label="Sign out" variant="ghost" onPress={onSignOut} />
      </View>
    </View>
  );
}
