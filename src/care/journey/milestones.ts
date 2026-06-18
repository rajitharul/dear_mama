import { Ionicons } from '@expo/vector-icons';

import type { JourneyCategory } from '@/care/api';

// The curated template of pregnancy milestones — the "story" backbone of the Journey
// timeline. Each entry is positioned by a typical gestational-week window (weekFrom/weekTo),
// used both to order the timeline and to highlight what's "around now" against the mother's
// current gestational age. Recording a milestone writes a care_logs row (log_type='journey')
// keyed by `id`; the timeline merges this catalog with those recorded rows and any custom
// (milestoneId=null) events. Editing this list is safe — recorded rows copy their own
// title/category, so they stay readable even if a catalog entry changes or is removed.

export type Milestone = {
  id: string;
  title: string;
  category: JourneyCategory;
  weekFrom?: number; // typical gestational-week window (for ordering & "around now")
  weekTo?: number;
  icon: keyof typeof Ionicons.glyphMap;
  hint?: string;
};

/** Per-category display metadata (label + icon) for pills and grouping. */
export const JOURNEY_CATEGORIES: Record<
  JourneyCategory,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  beginning: { label: 'Beginnings', icon: 'sparkles-outline' },
  clinical: { label: 'Scans & tests', icon: 'medical-outline' },
  baby_body: { label: 'Baby & body', icon: 'heart-outline' },
  prep: { label: 'Sharing & prep', icon: 'gift-outline' },
};

export const MILESTONES: Milestone[] = [
  // 🟢 Beginnings
  { id: 'found_out', title: 'Found out you’re pregnant', category: 'beginning', weekFrom: 4, weekTo: 5, icon: 'sparkles-outline', hint: 'The day it all began.' },
  { id: 'first_appt', title: 'First prenatal appointment', category: 'beginning', weekFrom: 6, weekTo: 8, icon: 'calendar-outline' },
  { id: 'first_heartbeat', title: 'Heard the heartbeat', category: 'beginning', weekFrom: 6, weekTo: 10, icon: 'heart-outline' },
  { id: 'first_scan_photo', title: 'First ultrasound photo', category: 'beginning', weekFrom: 8, weekTo: 12, icon: 'image-outline' },

  // 🔬 Clinical scans & tests
  { id: 'dating_scan', title: 'Dating scan', category: 'clinical', weekFrom: 8, weekTo: 12, icon: 'scan-outline' },
  { id: 'nt_scan', title: 'NT scan / 1st-trimester screening', category: 'clinical', weekFrom: 11, weekTo: 14, icon: 'scan-outline' },
  { id: 'nipt', title: 'NIPT / genetic screening', category: 'clinical', weekFrom: 10, weekTo: 14, icon: 'flask-outline' },
  { id: 'anomaly_scan', title: 'Anomaly scan (20-week)', category: 'clinical', weekFrom: 18, weekTo: 22, icon: 'scan-outline' },
  { id: 'gtt', title: 'Glucose tolerance test', category: 'clinical', weekFrom: 24, weekTo: 28, icon: 'water-outline' },
  { id: 'tdap', title: 'Tdap / whooping-cough vaccine', category: 'clinical', weekFrom: 27, weekTo: 36, icon: 'medical-outline' },
  { id: 'gbs', title: 'Group B strep swab', category: 'clinical', weekFrom: 35, weekTo: 37, icon: 'medical-outline' },
  { id: 'growth_scan', title: 'Growth scan', category: 'clinical', weekFrom: 28, weekTo: 40, icon: 'scan-outline' },

  // 💗 Baby & body milestones
  { id: 'showing', title: 'Started showing', category: 'baby_body', weekFrom: 12, weekTo: 20, icon: 'body-outline' },
  { id: 'sex_reveal', title: 'Found out the sex', category: 'baby_body', weekFrom: 16, weekTo: 20, icon: 'help-circle-outline' },
  { id: 'first_kick', title: 'First kick felt', category: 'baby_body', weekFrom: 16, weekTo: 25, icon: 'football-outline' },
  { id: 'hiccups', title: 'Felt baby hiccups', category: 'baby_body', weekFrom: 26, weekTo: 40, icon: 'pulse-outline' },
  { id: 'chose_name', title: 'Chose a name', category: 'baby_body', icon: 'pricetag-outline', hint: 'Whenever it felt right.' },

  // 📣 Sharing & preparation
  { id: 'announced', title: 'Announced the pregnancy', category: 'prep', weekFrom: 12, weekTo: 16, icon: 'megaphone-outline' },
  { id: 'baby_shower', title: 'Baby shower', category: 'prep', weekFrom: 28, weekTo: 36, icon: 'gift-outline' },
  { id: 'classes', title: 'Antenatal / birthing class', category: 'prep', weekFrom: 28, weekTo: 36, icon: 'school-outline' },
  { id: 'nursery', title: 'Nursery ready', category: 'prep', weekFrom: 30, weekTo: 38, icon: 'home-outline' },
  { id: 'mat_leave', title: 'Maternity leave started', category: 'prep', weekFrom: 32, weekTo: 36, icon: 'briefcase-outline' },
  { id: 'birth_plan', title: 'Birth plan written', category: 'prep', weekFrom: 32, weekTo: 37, icon: 'document-text-outline' },
  { id: 'hospital_bag', title: 'Hospital bag packed', category: 'prep', weekFrom: 35, weekTo: 39, icon: 'bag-handle-outline' },

  // 🏁 Closing
  { id: 'baby_arrived', title: 'Baby arrived 🎉', category: 'beginning', weekFrom: 37, weekTo: 42, icon: 'gift-outline', hint: 'The big day.' },
];

const BY_ID = new Map(MILESTONES.map((m) => [m.id, m]));
export const milestoneById = (id: string): Milestone | null => BY_ID.get(id) ?? null;

/**
 * Passive, computed timeline anchors (trimester/term transitions + the due date). These are
 * *not* recordable — they just orient the timeline in gestational time. `date` is only set for
 * the due date (derived from the EDD); the rest are positioned purely by week.
 */
export type JourneyAnchor = { week: number; label: string; date?: Date };
export function derivedAnchors(edd: Date | null): JourneyAnchor[] {
  const anchors: JourneyAnchor[] = [
    { week: 14, label: 'Second trimester begins' },
    { week: 24, label: 'Viability' },
    { week: 28, label: 'Third trimester begins' },
    { week: 37, label: 'Full term' },
  ];
  if (edd) anchors.push({ week: 40, label: 'Estimated due date', date: edd });
  return anchors;
}
