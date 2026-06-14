import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { babyCountLabel } from '@/onboarding/labels';
import type { OnboardingData } from '@/onboarding/types';
import { eddFromLmp, formatGestationalAge, gestationalAge } from '@/pregnancy/weekMath';
import { useTheme } from '@/theme';
import { AppText, Button, Card, OrganicBackdrop, Pill } from '@/ui';

export function Home({
  data,
  onEdit,
  onSignOut,
}: {
  data: OnboardingData;
  onEdit: () => void;
  onSignOut: () => void;
}) {
  const t = useTheme();
  const chosen = data.date ? new Date(data.date) : null;
  const edd = chosen ? (data.dateMode === 'edd' ? chosen : eddFromLmp(chosen)) : null;
  const ga = edd ? gestationalAge(edd) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top']}>
      <OrganicBackdrop />
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.xl, gap: t.spacing.lg, paddingBottom: t.spacing.xxxl }}
        showsVerticalScrollIndicator={false}>
        <View style={{ gap: t.spacing.xs }}>
          <AppText variant="bodyMuted">Welcome back</AppText>
          <AppText variant="display">{data.displayName.trim() || 'Mama'} 🤍</AppText>
        </View>

        {ga && edd ? (
          <Card style={{ backgroundColor: t.colors.accentSoft, borderColor: 'transparent', gap: t.spacing.md }}>
            <Pill label={babyCountLabel(data.babyCount)} tone="accent" icon="heart" />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm }}>
              <AppText variant="display" color={t.colors.accent}>
                {formatGestationalAge(ga)}
              </AppText>
            </View>
            <AppText variant="bodyMuted">
              {ga.isOverdue
                ? 'Any day now — your due date has arrived!'
                : `${ga.weeksToGo} weeks to go · trimester ${ga.trimester}`}
            </AppText>
            {/* progress bar */}
            <View style={{ height: 8, borderRadius: t.radius.pill, backgroundColor: t.colors.surface, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${Math.round(ga.progress * 100)}%`,
                  height: '100%',
                  backgroundColor: t.colors.accent,
                  borderRadius: t.radius.pill,
                }}
              />
            </View>
            <AppText variant="caption">Estimated due {format(edd, 'EEEE, d MMMM yyyy')}</AppText>
          </Card>
        ) : null}

        <Card style={{ gap: t.spacing.sm }}>
          <AppText variant="label">YOUR DETAILS</AppText>
          {data.age ? <Detail icon="person-outline" text={`Age ${data.age}`} /> : null}
          <Detail icon="people-outline" text={babyCountLabel(data.babyCount)} />
          {data.bloodType ? <Detail icon="water-outline" text={`Blood type ${data.bloodType}`} /> : null}
          {data.allergies.length ? <Detail icon="alert-circle-outline" text={`Allergies: ${data.allergies.join(', ')}`} /> : null}
          {data.medications.length ? <Detail icon="medkit-outline" text={`Meds: ${data.medications.join(', ')}`} /> : null}
          {data.emergencyName ? (
            <Detail icon="call-outline" text={`Emergency: ${data.emergencyName}${data.emergencyPhone ? ` · ${data.emergencyPhone}` : ''}`} />
          ) : null}
          {data.careName ? <Detail icon="medical-outline" text={`${data.careRole.toUpperCase()}: ${data.careName}`} /> : null}
        </Card>

        <Button label="Edit details" variant="secondary" icon="create-outline" onPress={onEdit} />
        <Button label="Sign out" variant="ghost" icon="log-out-outline" onPress={onSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
      <Ionicons name={icon} size={18} color={t.colors.accent} />
      <AppText variant="body" style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}
