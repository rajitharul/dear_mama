export const BABY_COUNT_OPTIONS = [
  { value: '1', label: 'One baby', icon: 'happy-outline' },
  { value: '2', label: 'Twins', icon: 'people-outline' },
  { value: '3', label: 'Triplets', icon: 'people-circle-outline' },
  { value: '4', label: 'More', icon: 'add-circle-outline' },
] as const;

export function babyCountLabel(value: string): string {
  return BABY_COUNT_OPTIONS.find((o) => o.value === value)?.label ?? 'One baby';
}

export const DATE_SOURCE_OPTIONS = [
  { value: 'doctor', label: 'My doctor confirmed it' },
  { value: 'self', label: 'I calculated it myself' },
] as const;

export function dateSourceLabel(value: string | null): string | null {
  if (!value) return null;
  return DATE_SOURCE_OPTIONS.find((o) => o.value === value)?.label ?? null;
}
