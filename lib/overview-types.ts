// Pure client-safe types for ASHA workspace and PHC doctor overview APIs.
import type { RiskLevel, SnapshotEvent, SnapshotScheduleItem, SnapshotVisit } from '@/lib/snapshot-types';

export interface PatientVisitSummary {
  id: string;
  visitedAt: string;
  gestationWeeks: number | null;
  bpSys: number | null;
  bpDia: number | null;
  hb: number | null;
  symptoms: string[];
  riskLevel: RiskLevel;
  riskReasons: SnapshotVisit['risk']['reasons'];
}

export interface PatientNextFollowUp {
  id: string;
  dueDate: string;
  reason: string | null;
  status: 'overdue' | 'today' | 'upcoming';
}

export interface PatientSummary {
  id: string;
  name: string;
  village: string | null;
  age: number | null;
  parity: number | null;
  gestationWeeks: number | null;
  visitedToday: boolean;
  latestVisit: PatientVisitSummary | null;
  recentVisits: PatientVisitSummary[];
  nextFollowUp: PatientNextFollowUp | null;
}

export interface AshaOverview {
  asha: {
    name: string;
    phcName: string;
    doctorName: string | null;
    language: 'hi' | 'kn' | 'en';
  };
  counts: {
    visits: number;
    highRisk: number;
    alertsSent: number;
    followUps: number;
  };
  schedule: SnapshotScheduleItem[];
  patients: PatientSummary[];
  serverTime: string;
}

export interface DoctorVisitCase {
  id: string;
  visitedAt: string;
  beneficiary: {
    id: string;
    name: string;
    village: string | null;
    weeks: number | null;
    age: number | null;
    firstPregnancy: boolean | null;
  };
  ashaName: string;
  vitals: SnapshotVisit['vitals'];
  risk: SnapshotVisit['risk'];
  alert: SnapshotVisit['alert'];
  call: SnapshotVisit['call'];
  alertHeld: boolean;
  doctor: string | null;
  followUp: SnapshotVisit['followUp'];
  recentVisits: PatientVisitSummary[];
}

export interface DoctorOverview {
  doctor: {
    name: string;
    phcName: string;
  };
  asha: {
    id: string;
    name: string;
    phcName: string;
  } | null;
  counts: {
    visits: number;
    highRisk: number;
    alertsSent: number;
    followUps: number;
    overdueFollowUps: number;
    totalPatients: number;
  };
  cases: DoctorVisitCase[];
  schedule: SnapshotScheduleItem[];
  patients: PatientSummary[];
  events: SnapshotEvent[];
  serverTime: string;
  cursor: number;
}
