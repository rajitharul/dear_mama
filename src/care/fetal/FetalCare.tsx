import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addKick, listKicks } from '@/care/api';
import { MovementLogger } from '@/care/fetal/MovementLogger';
import { SessionCounter, type CounterConfig } from '@/care/fetal/SessionCounter';
import { useTheme } from '@/theme';
import { AppText, calmRise, Card, OrganicBackdrop } from '@/ui';

type Feature = {
  key: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const KICK_CONFIG: CounterConfig = {
  logType: 'kick',
  title: 'Kick counter',
  sessionTitle: 'Counting kicks',
  icon: 'footsteps-outline',
  nounOne: 'kick',
  nounMany: 'kicks',
  tapLabel: 'TAP FOR EACH KICK',
  startHelp: 'Settle in somewhere quiet and tap the circle each time you feel a sharp kick.',
  reachedHelp: 'Lovely — you’ve felt 10 kicks. Save this session whenever you’re ready.',
  emptyText: 'Tap “Start counting” and tap once for each kick you feel — a gentle way to get to know baby’s rhythm.',
  goal: 10,
  list: listKicks,
  save: (userId, count, durationMin, note, loggedAt) =>
    addKick(userId, { kind: 'kick', count, durationMin, note }, loggedAt),
};

const FEATURES: Feature[] = [
  {
    key: 'kicks',
    title: 'Kick counter',
    description: 'Count baby’s kicks in a quiet session.',
    icon: 'footsteps-outline',
  },
  {
    key: 'movements',
    title: 'Movements',
    description: 'Note rolls, flutters, hiccups and turns.',
    icon: 'pulse-outline',
  },
];

/** Fetal Care hub: counting baby’s kicks and noting their movements. */
export function FetalCare({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [feature, setFeature] = useState<Feature | null>(null);

  if (feature) {
    if (feature.key === 'kicks') {
      return <SessionCounter userId={userId} config={KICK_CONFIG} onBack={() => setFeature(null)} />;
    }
    return <MovementLogger userId={userId} onBack={() => setFeature(null)} />;
  }

  const entering = (delay: number) => (reduce ? undefined : calmRise(delay));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <OrganicBackdrop />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          paddingHorizontal: t.spacing.xl,
          paddingTop: t.spacing.sm,
        }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={onBack}>
          <Ionicons name="chevron-back" size={26} color={t.colors.text} />
        </Pressable>
        <AppText variant="subtitle">Fetal care</AppText>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.xl,
          paddingTop: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={entering(0)} style={{ gap: t.spacing.xs }}>
          <AppText variant="bodyMuted" style={{ maxWidth: 320 }}>
            Get to know your baby — count their kicks and note the little movements you feel.
          </AppText>
        </Animated.View>

        <AppText variant="label">TRACK & LOG</AppText>
        {FEATURES.map((f, i) => (
          <Animated.View key={f.key} entering={entering(90 + i * 70)}>
            <Card onPress={() => setFeature(f)} style={{ gap: t.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: t.radius.md,
                    backgroundColor: t.colors.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={f.icon} size={22} color={t.colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="subtitle">{f.title}</AppText>
                  <AppText variant="bodyMuted">{f.description}</AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={t.colors.textTertiary} />
              </View>
            </Card>
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
