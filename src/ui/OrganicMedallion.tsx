import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

const BLOB_A =
  'M52.7,-57.6C66.6,-45.8,75.3,-27.9,76.8,-9.3C78.3,9.3,72.6,28.6,60.6,42.8C48.6,57,30.3,66.1,10.4,71.2C-9.6,76.3,-31.2,77.4,-46.9,67.6C-62.6,57.8,-72.4,37.1,-75.6,16.1C-78.8,-4.9,-75.4,-26.2,-63.9,-41.9C-52.4,-57.6,-32.8,-67.7,-13.1,-71.9C6.6,-76.1,26.3,-74.4,52.7,-57.6Z';
const BLOB_B =
  'M48.4,-54.3C61.5,-42.6,70.3,-26.5,72.6,-9.4C74.9,7.7,70.7,25.8,60.2,39.6C49.7,53.4,32.9,62.9,14.4,67.8C-4.1,72.7,-24.3,73,-40.9,64.4C-57.5,55.8,-70.5,38.3,-74.7,19.1C-78.9,-0.1,-74.3,-21,-63.3,-36.6C-52.3,-52.2,-34.9,-62.5,-17.2,-66.1C0.5,-69.7,18.5,-66,48.4,-54.3Z';

/** Soft organic medallion: layered accent blobs + centred icon + botanical dots. */
export function OrganicMedallion({
  icon,
  size = 168,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
}) {
  const t = useTheme();
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <G translateX={100} translateY={100}>
          <Path d={BLOB_A} fill={t.colors.accentSoft} />
          <Path d={BLOB_B} fill={t.colors.accent} opacity={0.16} scale={0.82} />
          <Circle cx={62} cy={-58} r={6} fill={t.colors.accent} opacity={0.5} />
          <Circle cx={-70} cy={40} r={4} fill={t.colors.accent} opacity={0.4} />
          <Circle cx={48} cy={66} r={3} fill={t.colors.accent} opacity={0.35} />
        </G>
      </Svg>
      <View style={{ position: 'absolute' }}>
        <Ionicons name={icon} size={size * 0.34} color={t.colors.accent} />
      </View>
    </View>
  );
}
