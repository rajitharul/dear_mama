import { Image, View } from 'react-native';

import { useTheme } from '@/theme';

// Static asset map — React Native require() needs literal paths.
const ART = {
  welcome: require('../../assets/images/onboarding/welcome.png'),
  profile: require('../../assets/images/onboarding/profile.png'),
  pregnancy: require('../../assets/images/onboarding/pregnancy.png'),
  medical: require('../../assets/images/onboarding/medical.png'),
  contacts: require('../../assets/images/onboarding/contacts.png'),
  review: require('../../assets/images/onboarding/review.png'),
  reward1: require('../../assets/images/onboarding/reward1.png'),
  reward2: require('../../assets/images/onboarding/reward2.png'),
  reward3: require('../../assets/images/onboarding/reward3.png'),
  reward4: require('../../assets/images/onboarding/reward4.png'),
  rewardFinale: require('../../assets/images/onboarding/rewardFinale.png'),
} as const;

export type IllustrationName = keyof typeof ART;

/**
 * Generated onboarding artwork resting on a soft sage halo for grounding/depth.
 * The PNGs are transparent, so the halo reads as a gentle backdrop.
 */
export function Illustration({
  name,
  size = 168,
  halo = true,
}: {
  name: IllustrationName;
  size?: number;
  halo?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {halo ? (
        <View
          style={{
            position: 'absolute',
            width: size * 0.84,
            height: size * 0.84,
            borderRadius: size,
            backgroundColor: t.colors.accentSoft,
          }}
        />
      ) : null}
      <Image
        source={ART[name]}
        style={{ width: size * 0.92, height: size * 0.92 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
