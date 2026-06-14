import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentType } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/lib/errors';
import { ContactsStep } from '@/onboarding/steps/Contacts';
import { MedicalStep } from '@/onboarding/steps/Medical';
import { PregnancyStep } from '@/onboarding/steps/Pregnancy';
import { ProfileStep } from '@/onboarding/steps/Profile';
import { ReviewStep } from '@/onboarding/steps/Review';
import { StepReward, type RewardContent } from '@/onboarding/StepReward';
import { emptyOnboarding, type OnboardingData, type StepProps } from '@/onboarding/types';
import { useTheme } from '@/theme';
import { AppText, Button, calmFade, calmRise, Card, Illustration, type IllustrationName, OrganicBackdrop, Stepper } from '@/ui';

type StepMeta = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  art: IllustrationName;
  /** Celebration shown after this step is completed. */
  reward: RewardContent;
  Comp: ComponentType<StepProps>;
  optional: boolean;
  valid: (d: OnboardingData) => boolean;
  /** Wrap the step body in a surface card (default true; Review brings its own cards). */
  card?: boolean;
};

const STEPS: StepMeta[] = [
  {
    key: 'profile',
    title: 'About you',
    subtitle: 'So DearMama can greet you properly.',
    icon: 'person-outline',
    art: 'profile',
    reward: { art: 'reward1', title: 'Lovely to meet you', subtitle: 'The heart of your space is set. A little seed has been planted.' },
    Comp: ProfileStep,
    optional: false,
    valid: (d) => d.displayName.trim().length > 0,
  },
  {
    key: 'pregnancy',
    title: 'Your pregnancy',
    subtitle: 'This anchors your weekly countdown.',
    icon: 'calendar-outline',
    art: 'pregnancy',
    reward: { art: 'reward2', title: 'Your countdown begins', subtitle: 'Every week from here, we’ll grow together — your journey is budding.' },
    Comp: PregnancyStep,
    optional: false,
    valid: (d) => Boolean(d.date),
  },
  {
    key: 'medical',
    title: 'Medical baseline',
    subtitle: 'Helpful for your care team. Everything here is optional.',
    icon: 'fitness-outline',
    art: 'medical',
    reward: { art: 'reward3', title: 'Thank you for sharing', subtitle: 'Your care team will be glad you did. Your journey is blooming.' },
    Comp: MedicalStep,
    optional: true,
    valid: () => true,
  },
  {
    key: 'contacts',
    title: 'Contacts & care team',
    subtitle: 'So help is one tap away. Optional, but recommended.',
    icon: 'people-outline',
    art: 'contacts',
    reward: { art: 'reward4', title: 'Your circle of care is ready', subtitle: 'Support is always one tap away — and your bloom is fully open.' },
    Comp: ContactsStep,
    optional: true,
    valid: () => true,
  },
  {
    key: 'review',
    title: 'All set?',
    subtitle: 'Review your details before we begin.',
    icon: 'sparkles-outline',
    art: 'review',
    reward: { art: 'rewardBaby', title: 'Your journey is ready, mama', subtitle: 'Welcome to DearMama. We’ll be with you every step of the way.' },
    Comp: ReviewStep,
    optional: false,
    valid: () => true,
    card: false,
  },
];

export function Onboarding({
  initial,
  skipIntro = false,
  onComplete,
}: {
  initial?: OnboardingData;
  skipIntro?: boolean;
  onComplete: (data: OnboardingData) => void | Promise<void>;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState<OnboardingData>(initial ?? emptyOnboarding);
  const [started, setStarted] = useState(skipIntro);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reward, setReward] = useState(false);

  const set = (patch: Partial<OnboardingData>) => setDraft((d) => ({ ...d, ...patch }));
  const meta = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const entering = (delay: number) => (reduce ? undefined : calmRise(delay));

  if (!started) {
    return <Welcome onBegin={() => setStarted(true)} />;
  }

  // Every Continue earns a celebration; the finale then waits for the user to tap
  // Continue, so the saving (and navigation to Home) happens in onRewardDone.
  function goNext() {
    setReward(true);
  }

  // Inter-step rewards reveal the next step behind them. On the finale, the user
  // tapping Continue persists the profile — then the parent swaps the screen to Home.
  async function onRewardDone() {
    if (!isLast) {
      setReward(false);
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await onComplete(draft);
    } catch (e) {
      setSaving(false);
      setReward(false);
      Alert.alert('Could not save', errorMessage(e));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <OrganicBackdrop />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => (step === 0 ? setStarted(false) : setStep((s) => s - 1))}>
            <Ionicons name="chevron-back" size={26} color={t.colors.text} />
          </Pressable>
          <Stepper count={STEPS.length} currentIndex={step} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Animated.View key={`head-${step}`} entering={entering(0)} style={{ alignItems: 'center', gap: t.spacing.sm }}>
            <Illustration name={meta.art} />
            <AppText variant="title" center>
              {meta.title}
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 320 }}>
              {meta.subtitle}
            </AppText>
          </Animated.View>

          <Animated.View key={`body-${step}`} entering={entering(90)} style={{ gap: t.spacing.lg }}>
            {meta.card === false ? (
              <meta.Comp draft={draft} set={set} />
            ) : (
              <Card style={{ gap: t.spacing.lg }}>
                <meta.Comp draft={draft} set={set} />
              </Card>
            )}
          </Animated.View>
        </ScrollView>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, paddingBottom: t.spacing.lg, gap: t.spacing.sm }}>
          <Button
            label={isLast ? 'Create my journey' : 'Continue'}
            onPress={goNext}
            disabled={!meta.valid(draft)}
            loading={saving}
          />
          {meta.optional && !isLast ? (
            <Button label="Skip for now" variant="ghost" onPress={goNext} />
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <StepReward
        visible={reward}
        content={meta.reward}
        finale={isLast}
        busy={saving}
        progressLabel={isLast ? undefined : `Step ${step + 1} of ${STEPS.length} complete`}
        onDone={onRewardDone}
      />
    </SafeAreaView>
  );
}

const HIGHLIGHTS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'calendar-outline', text: 'A weekly countdown to your due date' },
  { icon: 'heart-outline', text: 'Your details, gently kept in one place' },
  { icon: 'lock-closed-outline', text: 'Private to you, synced securely to your account' },
];

function Welcome({ onBegin }: { onBegin: () => void }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }} edges={['top', 'bottom']}>
      <OrganicBackdrop />
      <View style={{ flex: 1, padding: t.spacing.xl, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.xl }}>
          <Animated.View entering={reduce ? undefined : calmFade(0)} style={{ alignItems: 'center' }}>
            <Illustration name="welcome" size={220} />
          </Animated.View>
          <Animated.View entering={reduce ? undefined : calmRise(120)} style={{ alignItems: 'center', gap: t.spacing.sm }}>
            <AppText variant="display" center>
              Welcome to DearMama
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
              Let’s set up your journey. It only takes a couple of minutes.
            </AppText>
          </Animated.View>
          <View style={{ gap: t.spacing.md, marginTop: t.spacing.sm }}>
            {HIGHLIGHTS.map((h, i) => (
              <Animated.View
                key={h.text}
                entering={reduce ? undefined : calmRise(220 + i * 90)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: t.radius.md,
                    backgroundColor: t.colors.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={h.icon} size={20} color={t.colors.accent} />
                </View>
                <AppText variant="body" style={{ flex: 1 }}>
                  {h.text}
                </AppText>
              </Animated.View>
            ))}
          </View>
        </View>
        <Animated.View entering={reduce ? undefined : calmRise(520)}>
          <Button label="Let’s begin" icon="arrow-forward" onPress={onBegin} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
