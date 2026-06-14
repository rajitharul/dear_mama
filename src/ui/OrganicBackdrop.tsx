import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

/** Faint organic shapes layered behind a screen for warmth. Decorative only. */
export function OrganicBackdrop() {
  const t = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Circle cx="88%" cy="-4%" r={130} fill={t.colors.accentSoft} opacity={0.6} />
        <Circle cx="105%" cy="14%" r={80} fill={t.colors.accent} opacity={0.06} />
        <Circle cx="-6%" cy="92%" r={150} fill={t.colors.accentSoft} opacity={0.5} />
        <Circle cx="10%" cy="100%" r={70} fill={t.colors.accent} opacity={0.05} />
      </Svg>
    </View>
  );
}
