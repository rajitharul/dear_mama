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
  rhFactor: '' | 'positive' | 'negative';
  prePregnancyWeight: string; // free text incl. unit, e.g. "62 kg"
  height: string; // free text incl. unit, e.g. "165 cm"
  conditions: string[];
  allergies: string[];
  medications: string[];
  priorPregnancies: string;
  obstetricHistory: string[]; // e.g. ["C-section", "Preeclampsia"]
  lifestyleFlags: string[]; // e.g. ["Smoking", "Alcohol"]
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
  rhFactor: '',
  prePregnancyWeight: '',
  height: '',
  conditions: [],
  allergies: [],
  medications: [],
  priorPregnancies: '',
  obstetricHistory: [],
  lifestyleFlags: [],
  medicalNotes: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
  careRole: 'ob',
  careName: '',
  carePhone: '',
  careClinic: '',
};
