import { useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { AppText, Illustration, type IllustrationName } from '@/ui';

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
  onDone,
}: {
  visible: boolean;
  content: RewardContent;
  /** e.g. "Step 1 of 5 complete" — omitted on the finale. */
  progressLabel?: string;
  finale?: boolean;
  onDone: () => void;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();

  const done = useRef(false);
  const enter = useSharedValue(0);

  // Pre-compute a calm spread of petals (positions/colors/timings) once per show.
  const petals = useMemo(() => {
    if (reduce) return [];
    const palette = [t.colors.accent, t.colors.accentSoft, '#E8B7AE', '#D8C3A5'];
    const count = finale ? 16 : 10;
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

  useEffect(() => {
    if (!visible) return;
    done.current = false;
    enter.value = 0;
    enter.value = withTiming(1, { duration: reduce ? 200 : 420, easing: EASE_OUT });

    // Finale lingers a touch longer; the parent unmounts us when navigation lands.
    const ms = finale ? 2600 : reduce ? 900 : 1700;
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
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel={`${content.title}. Tap to continue.`}
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

            <Illustration name={content.art} size={finale ? 200 : 168} />

            <AppText variant="title" center>
              {content.title}
            </AppText>
            <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
              {content.subtitle}
            </AppText>

            <AppText variant="caption" center style={{ marginTop: t.spacing.xs }}>
              {finale ? 'One moment…' : 'Tap to continue'}
            </AppText>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}
