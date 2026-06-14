import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppTabs } from '@/app/AppTabs';
import { signOut } from '@/features/auth/api';
import { SignIn } from '@/features/auth/SignIn';
import { useSession } from '@/features/auth/session';
import { Onboarding } from '@/onboarding/Onboarding';
import type { OnboardingData } from '@/onboarding/types';
import { loadProfile, saveProfile } from '@/profile/api';
import { clearCache, loadCache } from '@/storage/profile';
import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

export default function Index() {
  const { session, initializing } = useSession();

  if (initializing) return <Splash />;
  if (!session) return <SignIn />;
  return <Authed userId={session.user.id} />;
}

function Authed({ userId }: { userId: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [profile, setProfile] = useState<OnboardingData | null>(null);
  const [editing, setEditing] = useState(false);

  // Loads the profile without touching state synchronously (so it's safe to
  // call from an effect). State updates happen after the awaited fetch.
  const loadInto = useCallback(async () => {
    try {
      const p = await loadProfile();
      setProfile(p);
      setState('ready');
    } catch {
      // Network/timeout: fall back to the offline cache if we have one.
      const cached = await loadCache();
      if (cached) {
        setProfile(cached);
        setState('ready');
      } else {
        setState('error');
      }
    }
  }, []);

  const retry = useCallback(() => {
    setState('loading');
    void loadInto();
  }, [loadInto]);

  useEffect(() => {
    // loadInto only sets state after an awaited fetch (never synchronously),
    // so the cascading-render warning doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInto();
  }, [loadInto]);

  async function handleSignOut() {
    await clearCache();
    await signOut();
  }

  // Direct profile save (e.g. editing the medical baseline from the Care tab) —
  // persists and updates state in place, without re-entering the onboarding wizard.
  const saveProfileDirect = useCallback(
    async (d: OnboardingData) => {
      await saveProfile(userId, d);
      setProfile(d);
    },
    [userId],
  );

  if (state === 'loading') return <Splash />;
  if (state === 'error') return <ErrorRetry onRetry={retry} onSignOut={handleSignOut} />;

  if (!profile || editing) {
    return (
      <Onboarding
        initial={profile ?? undefined}
        skipIntro={editing}
        onComplete={async (d) => {
          await saveProfile(userId, d);
          setProfile(d);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <AppTabs
      data={profile}
      onEdit={() => setEditing(true)}
      onSignOut={handleSignOut}
      onSaveProfile={saveProfileDirect}
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

function ErrorRetry({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.lg, padding: t.spacing.xl, backgroundColor: t.colors.background }}>
      <AppText variant="title" center>
        Can’t reach the server
      </AppText>
      <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
        Check your connection and try again.
      </AppText>
      <View style={{ alignSelf: 'stretch', gap: t.spacing.sm }}>
        <Button label="Try again" icon="refresh" onPress={onRetry} />
        <Button label="Sign out" variant="ghost" onPress={onSignOut} />
      </View>
    </View>
  );
}
