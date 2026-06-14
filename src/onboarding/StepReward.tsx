import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { AppText, Button, Illustration, type IllustrationName } from '@/ui';

const EASE_OUT = Easing.out(Easing.cubic);

/** A single petal drifting down + fading — the celebratory confetti. */
function Petal({
  startX,
  size,
  color,
  delay,
  drift,
  fallTo,
  spin,
}: {
  startX: number;
  size: number;
  color: string;
  delay: number;
  drift: number;
  fallTo: number;
  spin: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 2600, easing: EASE_OUT }));
  }, [p, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: startX + drift * p.value },
      { translateY: -40 + fallTo * p.value },
      { rotate: `${spin * p.value}deg` },
    ],
    // gentle in, lingering, then out
    opacity: p.value < 0.15 ? p.value / 0.15 : p.value > 0.8 ? (1 - p.value) / 0.2 : 1,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size * 1.3,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
          borderBottomLeftRadius: size,
          borderBottomRightRadius: size * 0.3,
          backgroundColor: color,
          opacity: 0.9,
        },
        style,
      ]}
    />
  );
}

/** A heart drifting upward + fading — the finale's tender confetti. */
function Heart({
  startX,
  startY,
  size,
  color,
  delay,
  drift,
  riseTo,
}: {
  startX: number;
  startY: number;
  size: number;
  color: string;
  delay: number;
  drift: number;
  riseTo: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 2800, easing: EASE_OUT }));
  }, [p, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: startX + drift * p.value },
      { translateY: startY - riseTo * p.value },
      { scale: 0.6 + 0.4 * p.value },
    ],
    opacity: p.value < 0.15 ? p.value / 0.15 : p.value > 0.75 ? (1 - p.value) / 0.25 : 1,
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0 }, style]}>
      <Ionicons name="heart" size={size} color={color} />
    </Animated.View>
  );
}

/** The finale baby — gently "breathing"/floating on a soft pulsing glow so it feels alive. */
function BabyHero({ size, reduce, glowColor }: { size: number; reduce: boolean; glowColor: string }) {
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, breath]);

  const babyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * breath.value }, { scale: 1 + 0.035 * breath.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.4 * breath.value,
    transform: [{ scale: 0.94 + 0.14 * breath.value }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', width: size * 0.9, height: size * 0.9, borderRadius: size, backgroundColor: glowColor },
          glowStyle,
        ]}
      />
      <Animated.View style={babyStyle}>
        <Illustration name="rewardBaby" size={size} halo={false} />
      </Animated.View>
    </View>
  );
}

export type RewardContent = {
  art: IllustrationName;
  title: string;
  subtitle: string;
};

export function StepReward({
  visible,
  content,
  progressLabel,
  finale = false,
  busy = false,
  onDone,
}: {
  visible: boolean;
  content: RewardContent;
  /** e.g. "Step 1 of 5 complete" — omitted on the finale. */
  progressLabel?: string;
  finale?: boolean;
  /** Finale only: show the Continue button in a loading state while saving. */
  busy?: boolean;
  onDone: () => void;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();

  const done = useRef(false);
  const enter = useSharedValue(0);

  // Pre-compute a calm spread of petals (positions/colors/timings) once per show.
  const petals = useMemo(() => {
    if (reduce) return [];
    const palette = [t.colors.accent, t.colors.accentSoft, '#E8B7AE', '#D8C3A5'];
    // On the finale we lighten the petals so the rising hearts read clearly.
    const count = finale ? 10 : 10;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      startX: 24 + Math.random() * (width - 48),
      size: 9 + Math.random() * 9,
      color: palette[i % palette.length],
      delay: Math.floor(Math.random() * 500),
      drift: (Math.random() - 0.5) * 90,
      fallTo: 260 + Math.random() * 220,
      spin: (Math.random() - 0.5) * 360,
    }));
  }, [reduce, finale, width, t.colors.accent, t.colors.accentSoft]);

  // Hearts rise only on the finale — the emotional beat for completing the journey.
  const hearts = useMemo(() => {
    if (reduce || !finale) return [];
    const palette = ['#E8B7AE', '#D98C82', t.colors.accent];
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      startX: width * 0.5 - 70 + Math.random() * 140,
      startY: height * 0.66 + Math.random() * 40,
      size: 16 + Math.random() * 12,
      color: palette[i % palette.length],
      delay: 200 + i * 260,
      drift: (Math.random() - 0.5) * 70,
      riseTo: height * 0.34 + Math.random() * height * 0.16,
    }));
  }, [reduce, finale, width, height, t.colors.accent]);

  useEffect(() => {
    if (!visible) return;
    done.current = false;
    enter.value = 0;
    enter.value = withTiming(1, { duration: reduce ? 200 : 420, easing: EASE_OUT });

    // The finale waits for the user to tap Continue (so the baby can be enjoyed);
    // inter-step rewards auto-advance after a short beat.
    if (finale) return;
    const ms = reduce ? 900 : 1700;
    const timer = setTimeout(() => finish(), ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, finale, reduce]);

  function finish() {
    if (done.current) return;
    done.current = true;
    onDone();
  }

  const scrimStyle = useAnimatedStyle(() => ({ opacity: enter.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: reduce
      ? [{ translateY: 0 }]
      : [{ translateY: (1 - enter.value) * 22 }, { scale: 0.94 + enter.value * 0.06 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={finish} statusBarTranslucent>
      <Pressable
        onPress={finale ? undefined : finish}
        accessibilityRole={finale ? undefined : 'button'}
        accessibilityLabel={finale ? undefined : `${content.title}. Tap to continue.`}
        style={{ flex: 1 }}>
        <Animated.View
          style={[
            { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(45,42,50,0.32)' },
            scrimStyle,
          ]}
        />
        {petals.map(({ id, ...p }) => (
          <Petal key={id} {...p} />
        ))}
        {hearts.map(({ id, ...h }) => (
          <Heart key={`h${id}`} {...h} />
        ))}

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xxl }}>
          <Animated.View
            style={[
              {
                width: '100%',
                maxWidth: 360,
                alignItems: 'center',
                gap: t.spacing.md,
                backgroundColor: t.colors.surface,
                borderRadius: t.radius.xl,
                paddingVertical: t.spacing.xxl,
                paddingHorizontal: t.spacing.xl,
                ...t.shadow.card,
              },
              cardStyle,
            ]}>
            {progressLabel ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.xs,
                  backgroundColor: t.colors.accentSoft,
                  paddingHorizontal: t.spacing.md,
                  paddingVertical: t.spacing.xs,
                  borderRadius: t.radius.pill,
                }}>
                <AppText variant="caption" color={t.colors.accent}>
                  {progressLabel}
                </AppText>
              </View>
            ) : null}

            {finale ? (
              <BabyHero size={210} reduce={reduce} glowColor={t.colors.accentSoft} />
            ) : (
              <Illustration name={content.art} size={168} />
            )}

            <AppText variant="title" center>
              {content.title}
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
              {content.subtitle}
            </AppText>

            {finale ? (
              <Button
                label={busy ? 'Saving…' : 'Continue'}
                icon="arrow-forward"
                onPress={finish}
                loading={busy}
                style={{ alignSelf: 'stretch', marginTop: t.spacing.sm }}
              />
            ) : (
              <AppText variant="caption" center style={{ marginTop: t.spacing.xs }}>
                Tap to continue
              </AppText>
            )}
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}
