import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CareTab } from '@/care/CareTab';
import { JourneyTimeline } from '@/care/journey/JourneyTimeline';
import { Home } from '@/home/Home';
import type { OnboardingData } from '@/onboarding/types';
import { PartnerAccess } from '@/partner/PartnerAccess';
import { useTheme } from '@/theme';
import { AppText, Button, Card, OrganicBackdrop, PressableScale } from '@/ui';

type Tab = 'home' | 'journey' | 'care' | 'profile';

const TABS: {
  key: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'journey', label: 'Journey', icon: 'map-outline', iconActive: 'map' },
  { key: 'care', label: 'Care', icon: 'heart-outline', iconActive: 'heart' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

// A partner follows along with the mother's care: they get the same shell, but only the tabs
// they have access to (Care) plus their Profile.
const PARTNER_TABS: Tab[] = ['care', 'profile'];

/**
 * Authed app shell: a lightweight bottom tab bar over the Home / Journey / Care / Profile screens.
 * Kept as local state (not a router navigator) so the anti-hang gate in `src/app/index.tsx` stays
 * untouched, matching the codebase's screens-as-state ethos. The same shell serves a partner
 * (`audience='partner'`) — same navigation, filtered to the tabs they can access.
 */
export function AppTabs({
  data,
  userId,
  onSignOut,
  onSaveProfile,
  onEdit,
  audience = 'mother',
}: {
  data: OnboardingData;
  userId: string;
  onSignOut: () => void;
  onSaveProfile: (d: OnboardingData) => Promise<void>;
  onEdit?: () => void;
  audience?: 'mother' | 'partner';
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabs = audience === 'partner' ? TABS.filter((x) => PARTNER_TABS.includes(x.key)) : TABS;
  const [tab, setTab] = useState<Tab>(audience === 'partner' ? 'care' : 'home');
  const [screen, setScreen] = useState<'tabs' | 'partners'>('tabs');

  // A full-screen overlay (no tab bar) reached from Profile → Partner access (mother only).
  if (screen === 'partners') {
    return <PartnerAccess motherId={userId} onBack={() => setScreen('tabs')} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' ? (
          <Home data={data} />
        ) : tab === 'journey' ? (
          <JourneyTimeline userId={userId} data={data} />
        ) : tab === 'care' ? (
          <CareTab data={data} userId={userId} onSave={onSaveProfile} audience={audience} />
        ) : (
          <ProfileTab
            data={data}
            audience={audience}
            onEdit={onEdit}
            onManagePartners={() => setScreen('partners')}
            onSignOut={onSignOut}
          />
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: t.colors.border,
          backgroundColor: t.colors.surface,
          paddingTop: t.spacing.sm,
          paddingBottom: Math.max(insets.bottom, t.spacing.sm),
          paddingHorizontal: t.spacing.md,
        }}>
        {tabs.map((item) => {
          const active = item.key === tab;
          const color = active ? t.colors.accent : t.colors.textTertiary;
          return (
            <PressableScale
              key={item.key}
              onPress={() => setTab(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minHeight: 44,
                paddingVertical: t.spacing.xs,
              }}>
              <Ionicons name={active ? item.iconActive : item.icon} size={24} color={color} />
              <AppText variant="caption" color={color}>
                {item.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** The Profile tab: account actions, including Sign out. Mother-only actions (edit the profile,
 *  manage partner access) are hidden for a partner. */
function ProfileTab({
  data,
  audience,
  onEdit,
  onManagePartners,
  onSignOut,
}: {
  data: OnboardingData;
  audience: 'mother' | 'partner';
  onEdit?: () => void;
  onManagePartners: () => void;
  onSignOut: () => void;
}) {
  const t = useTheme();
  const name = data.displayName.trim() || 'Mama';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <OrganicBackdrop />
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.xl, gap: t.spacing.lg, paddingBottom: t.spacing.xxxl }}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: t.spacing.xs }}>
          <AppText variant="bodyMuted">Profile</AppText>
          <AppText variant="display">{audience === 'partner' ? 'Partner' : name}</AppText>
          {audience === 'partner' ? (
            <AppText variant="bodyMuted" style={{ maxWidth: 320 }}>
              You’re following {name}’s care.
            </AppText>
          ) : null}
        </View>

        {audience === 'mother' ? (
          <Card style={{ gap: t.spacing.sm }}>
            <AppText variant="label">ACCOUNT</AppText>
            {onEdit ? (
              <Button label="Edit details" variant="secondary" icon="create-outline" onPress={onEdit} />
            ) : null}
            <Button label="Partner access" variant="secondary" icon="people-outline" onPress={onManagePartners} />
          </Card>
        ) : null}

        <Button label="Sign out" variant="ghost" icon="log-out-outline" onPress={onSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}
