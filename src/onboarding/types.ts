export type CareTeamRole = 'ob' | 'midwife' | 'clinic' | 'other';

/** Props every wizard step receives from the Onboarding container. */
export type StepProps = {
  draft: OnboardingData;
  set: (patch: Partial<OnboardingData>) => void;
};

export type OnboardingData = {
  // Profile
  displayName: string;
  age: string;
  // Pregnancy
  dateMode: 'edd' | 'lmp';
  date: string | null; // ISO yyyy-mm-dd of whichever mode is selected
  dateSource: 'doctor' | 'self' | null; // how the due date was determined
  dueDateDoctor: string; // who confirmed it (only when dateSource === 'doctor')
  babyCount: string; // '1' | '2' | '3' | '4' → one / twins / triplets / more
  // Medical (optional)
  bloodType: string;
  conditions: string[];
  allergies: string[];
  medications: string[];
  priorPregnancies: string;
  medicalNotes: string;
  // Contacts & care team (optional)
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  careRole: CareTeamRole;
  careName: string;
  carePhone: string;
  careClinic: string;
  // Meta
  completedAt?: string;
};

export const emptyOnboarding: OnboardingData = {
  displayName: '',
  age: '',
  dateMode: 'edd',
  date: null,
  dateSource: null,
  dueDateDoctor: '',
  babyCount: '1',
  bloodType: '',
  conditions: [],
  allergies: [],
  medications: [],
  priorPregnancies: '',
  medicalNotes: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
  careRole: 'ob',
  careName: '',
  carePhone: '',
  careClinic: '',
};
