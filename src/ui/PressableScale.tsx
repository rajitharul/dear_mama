import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DURATION, EASE_OUT } from '@/ui/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a subtle scale-down + dim on press. Honors reduced-motion. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  disabled,
  ...rest
}: PressableProps & { children: ReactNode; style?: ViewStyle; scaleTo?: number }) {
  const reduce = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    opacity: 1 - pressed.value * 0.12,
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) pressed.value = reduce ? 0 : withTiming(1, { duration: DURATION.fast, easing: EASE_OUT });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: DURATION.fast, easing: EASE_OUT });
      }}
      style={[style, animatedStyle]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
