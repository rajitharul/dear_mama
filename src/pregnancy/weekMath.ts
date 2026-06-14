import { addDays, differenceInCalendarDays } from 'date-fns';

/** A full-term pregnancy is 280 days (40 weeks) from the last menstrual period. */
export const GESTATION_DAYS = 280;

export function eddFromLmp(lmp: Date): Date {
  return addDays(lmp, GESTATION_DAYS);
}
export function lmpFromEdd(edd: Date): Date {
  return addDays(edd, -GESTATION_DAYS);
}

export type GestationalAge = {
  weeks: number;
  days: number;
  weeksToGo: number;
  daysToGo: number;
  trimester: 1 | 2 | 3;
  progress: number; // 0..1
  isOverdue: boolean;
};

export function gestationalAge(edd: Date, today: Date = new Date()): GestationalAge {
  const daysToGo = differenceInCalendarDays(edd, today);
  const totalDays = Math.max(0, GESTATION_DAYS - daysToGo);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const trimester: 1 | 2 | 3 = weeks < 14 ? 1 : weeks < 28 ? 2 : 3;
  return {
    weeks,
    days,
    weeksToGo: Math.max(0, Math.floor(daysToGo / 7)),
    daysToGo,
    trimester,
    progress: Math.max(0, Math.min(1, totalDays / GESTATION_DAYS)),
    isOverdue: daysToGo < 0,
  };
}

export function formatGestationalAge(ga: GestationalAge): string {
  return ga.days > 0 ? `Week ${ga.weeks} · ${ga.days}d` : `Week ${ga.weeks}`;
}
