import { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';

/** Calm, smooth motion — ease-out, no spring bounce. */
export const EASE_OUT = Easing.out(Easing.cubic);
export const DURATION = { fast: 180, base: 320, slow: 460 } as const;

export const calmFade = (delay = 0) => FadeIn.duration(DURATION.base).delay(delay).easing(EASE_OUT);
export const calmRise = (delay = 0) =>
  FadeInDown.duration(DURATION.slow).delay(delay).easing(EASE_OUT);
