import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/ui/AppText';
import { DURATION, EASE_OUT } from '@/ui/motion';
import { useTheme } from '@/theme';

function Indicator({ index, currentIndex }: { index: number; currentIndex: number }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const completed = index < currentIndex;
  const active = index === currentIndex;

  const scale = useSharedValue(1);
  useEffect(() => {
    if (active && !reduce) {
      scale.value = 0.75;
      scale.value = withTiming(1, { duration: DURATION.base, easing: EASE_OUT });
    }
  }, [active, reduce, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const filled = completed || active;
  return (
    <Animated.View
      style={[
        {
          width: 28,
          height: 28,
          borderRadius: t.radius.pill,
          backgroundColor: filled ? t.colors.accent : t.colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: active ? 3 : 0,
          borderColor: t.colors.accentSoft,
        },
        animatedStyle,
      ]}>
      {completed ? (
        <Ionicons name="checkmark" size={16} color={t.colors.accentOn} />
      ) : (
        <AppText variant="caption" weight="bold" color={filled ? t.colors.accentOn : t.colors.textTertiary}>
          {index + 1}
        </AppText>
      )}
    </Animated.View>
  );
}

/** Numbered step indicator with connectors and completed/active/inactive states. */
export function Stepper({ count, currentIndex }: { count: number; currentIndex: number }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentIndex + 1} of ${count}`}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', flex: i < count - 1 ? 1 : 0 }}>
          <Indicator index={i} currentIndex={currentIndex} />
          {i < count - 1 ? (
            <View
              style={{
                flex: 1,
                height: 3,
                marginHorizontal: 6,
                borderRadius: t.radius.pill,
                backgroundColor: i < currentIndex ? t.colors.accent : t.colors.surfaceMuted,
              }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
