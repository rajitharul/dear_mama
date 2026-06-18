import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CareTab } from '@/care/CareTab';
import { JourneyTimeline } from '@/care/journey/JourneyTimeline';
import { Home } from '@/home/Home';
import type { OnboardingData } from '@/onboarding/types';
import { useTheme } from '@/theme';
import { AppText, PressableScale } from '@/ui';

type Tab = 'home' | 'journey' | 'care';

const TABS: {
  key: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'journey', label: 'Journey', icon: 'map-outline', iconActive: 'map' },
  { key: 'care', label: 'Care', icon: 'heart-outline', iconActive: 'heart' },
];

/**
 * Authed app shell: a lightweight bottom tab bar over the Home / Care screens.
 * Kept as local state (not a router navigator) so the anti-hang gate in
 * `src/app/index.tsx` stays untouched, matching the codebase's screens-as-state ethos.
 */
export function AppTabs({
  data,
  userId,
  onEdit,
  onSignOut,
  onSaveProfile,
}: {
  data: OnboardingData;
  userId: string;
  onEdit: () => void;
  onSignOut: () => void;
  onSaveProfile: (d: OnboardingData) => Promise<void>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' ? (
          <Home data={data} onEdit={onEdit} onSignOut={onSignOut} />
        ) : tab === 'journey' ? (
          <JourneyTimeline userId={userId} data={data} />
        ) : (
          <CareTab data={data} userId={userId} onSave={onSaveProfile} />
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
        {TABS.map((item) => {
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
