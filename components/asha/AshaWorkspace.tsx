'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Mic,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { SaathiAvatar } from './SaathiAvatar';
import { ConnectingGreetings } from './ConnectingGreetings';
import { GoodToKnow } from './RecordGuide';
import { SchedulePanel } from './SchedulePanel';
import { TabBar, type TabDef } from './TabBar';
import { VoicePicker } from './VoicePicker';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { HELLO } from '@/lib/i18n';
import { LANGUAGES, LANGUAGE_ORDER, type LangCode } from '@/lib/languages';
import { VOICES, resolveVoice } from '@/lib/voices';
import { daysUntil, dueNowCount, formatDueDate, todayInIndia } from '@/lib/asha/schedule';
import type { AshaOverview, PatientSummary, PatientVisitSummary } from '@/lib/overview-types';
import type { RiskLevel, SnapshotScheduleItem } from '@/lib/snapshot-types';
import { cn } from '@/lib/utils';

type WorkspaceTab = 'home' | 'schedule' | 'patients';
type PatientFilter = 'all' | 'high_risk' | 'pending' | 'visited';

export interface AshaWorkspaceProps {
  isStartingCall: boolean;
  callError: string | null;
  onStartCall: () => void;
  language: LangCode;
  onLanguageChange: (code: LangCode) => void;
  voice: string;
  onVoiceChange: (id: string) => void;
  playingVoice?: string | null;
  overview: AshaOverview | null;
  isOverviewLoading: boolean;
  overviewError: string | null;
  onRefreshOverview: () => void;
}

interface RiskBadgeStyle {
  label: string;
  className: string;
}

const RISK_STYLES: Record<RiskLevel, RiskBadgeStyle> = {
  urgent: { label: 'Urgent', className: 'bg-asha-red text-white' },
  high: { label: 'High', className: 'bg-asha-red-soft text-asha-red border border-asha-red/20' },
  watch: { label: 'Watch', className: 'bg-asha-amber text-[#7A4E0A]' },
  normal: { label: 'Normal', className: 'bg-asha-mint text-asha-teal' },
};

const PENDING_BADGE: RiskBadgeStyle = {
  label: 'Pending',
  className: 'bg-asha-sand text-asha-muted',
};

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AS';
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

function getPatientBadge(patient: PatientSummary): RiskBadgeStyle {
  if (!patient.latestVisit) return PENDING_BADGE;
  return RISK_STYLES[patient.latestVisit.riskLevel];
}

function isHighRiskPatient(patient: PatientSummary): boolean {
  const level = patient.latestVisit?.riskLevel;
  return level === 'urgent' || level === 'high';
}

function formatParity(parity: number | null): string | null {
  if (parity === null) return null;
  if (parity === 0) return '1st pregnancy';
  if (parity === 1) return '2nd pregnancy';
  if (parity === 2) return '3rd pregnancy';
  return `${parity + 1}th pregnancy`;
}

function formatVisitDate(iso: string, lang: string): string {
  const locale = lang === 'en' ? 'en-GB' : `${lang}-IN`;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function AshaWorkspace({
  isStartingCall,
  callError,
  onStartCall,
  language,
  onLanguageChange,
  voice,
  onVoiceChange,
  playingVoice,
  overview,
  isOverviewLoading,
  overviewError,
  onRefreshOverview,
}: AshaWorkspaceProps) {
  const router = useRouter();
  const { s, uiLang } = useLanguage();
  const [tab, setTab] = useState<WorkspaceTab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [patientFilter, setPatientFilter] = useState<PatientFilter>('all');
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const selectedVoiceName = resolveVoice(language, voice).name;
  const today = useMemo(() => todayInIndia(), []);
  const schedule = useMemo(() => overview?.schedule ?? [], [overview]);
  const patients = useMemo(() => overview?.patients ?? [], [overview]);
  const dueNow = useMemo(() => dueNowCount(schedule, today), [schedule, today]);

  // Overdue + due today items for the "Up next today" card
  const upNextSchedule = useMemo(
    () =>
      schedule
        .filter((item) => daysUntil(item, today) <= 0)
        .sort((a, b) => daysUntil(a, today) - daysUntil(b, today)),
    [schedule, today],
  );

  // Pending high-risk mothers who haven't been visited today and aren't already listed in upNextSchedule
  const pendingHighRisk = useMemo(() => {
    const scheduledNames = new Set(upNextSchedule.map((item) => item.beneficiary.name.toLowerCase()));
    return patients.filter(
      (patient) =>
        isHighRiskPatient(patient) &&
        !patient.visitedToday &&
        !scheduledNames.has(patient.name.toLowerCase()),
    );
  }, [patients, upNextSchedule]);

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((patient) => {
      if (patientFilter === 'high_risk' && !isHighRiskPatient(patient)) return false;
      if (patientFilter === 'pending' && patient.visitedToday) return false;
      if (patientFilter === 'visited' && !patient.visitedToday) return false;
      if (!q) return true;
      const inName = patient.name.toLowerCase().includes(q);
      const inVillage = (patient.village ?? '').toLowerCase().includes(q);
      return inName || inVillage;
    });
  }, [patients, patientFilter, searchQuery]);

  // Close open modals on Escape
  useEffect(() => {
    if (!selectedPatient && !isVoiceModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedPatient(null);
        setIsVoiceModalOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPatient, isVoiceModalOpen]);

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/login');
  }

  function openPatientByName(name: string) {
    const match = patients.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (match) {
      setSelectedPatient(match);
    }
  }

  function handleSelectScheduleItem(item: SnapshotScheduleItem) {
    openPatientByName(item.beneficiary.name);
  }

  function handleTalkFromModal() {
    setSelectedPatient(null);
    onStartCall();
  }

  const tabs: TabDef<WorkspaceTab>[] = [
    { key: 'home', label: 'Talk' },
    {
      key: 'schedule',
      label: s.tabSchedule,
      badge:
        dueNow > 0 ? (
          <span
            className="min-w-6 rounded-full bg-asha-red px-1.5 text-center text-xs font-bold leading-5 text-white"
            aria-label={s.schedDue(dueNow)}
          >
            {dueNow}
          </span>
        ) : undefined,
    },
    {
      key: 'patients',
      label: 'Patients',
      badge:
        patients.length > 0 ? (
          <span className="min-w-6 rounded-full bg-asha-sand px-1.5 text-center text-xs font-bold leading-5 text-asha-ink">
            {patients.length}
          </span>
        ) : undefined,
    },
  ];

  const ashaName = overview?.asha.name ?? 'ASHA Saathi';
  const ashaSubline = overview ? `ASHA · ${overview.asha.phcName}` : isOverviewLoading ? 'Loading workspace…' : 'ASHA Workspace';
  const upNextTotal = upNextSchedule.length + pendingHighRisk.length;
  const isSessionExpired = overviewError === 'SESSION_EXPIRED';

  return (
    <div className="h-full w-full overflow-y-auto bg-asha-cream text-asha-ink">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8 lg:pt-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-asha-teal text-lg font-bold text-white">
              {overview ? getInitials(overview.asha.name) : 'AS'}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold leading-6 text-asha-ink sm:text-xl">{ashaName}</h1>
              <p className="truncate text-sm text-asha-muted">{ashaSubline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              disabled={isStartingCall}
              aria-label={`Change language and voice. Current: ${LANGUAGES[language].native}, ${selectedVoiceName}`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-asha-line bg-white px-3.5 text-sm font-semibold text-asha-ink transition-colors hover:bg-asha-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal disabled:opacity-60"
            >
              <SlidersHorizontal className="h-4 w-4 text-asha-teal" aria-hidden />
              <span className="max-w-[10rem] truncate sm:max-w-none">
                {LANGUAGES[language].native} · {selectedVoiceName}
              </span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-asha-muted transition-colors hover:bg-asha-sand hover:text-asha-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{s.signOut}</span>
            </button>
          </div>
        </header>

        {/* Overview error banner */}
        {overviewError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-asha-red/20 bg-asha-red-soft px-4 py-3 text-sm text-asha-red"
          >
            <div className="flex items-center gap-2 font-medium">
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                {isSessionExpired
                  ? s.signedOut
                  : overviewError === 'FORBIDDEN'
                    ? 'This account cannot view the ASHA workspace.'
                    : 'Could not load your schedule and patients right now.'}
              </span>
            </div>
            {isSessionExpired ? (
              <Link
                href="/login?expired=1"
                className="rounded-full bg-asha-red px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90"
              >
                {s.signInAgain}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onRefreshOverview}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-asha-red shadow-sm hover:bg-asha-cream"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {s.retry}
              </button>
            )}
          </div>
        )}

        {/* Today's Summary Pills */}
        {overview && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Today's summary">
            <span className="rounded-full border border-asha-line bg-white px-3.5 py-1.5 text-sm font-semibold text-asha-ink">
              {s.visitsToday(overview.counts.visits)}
            </span>
            {overview.counts.highRisk > 0 && (
              <span className="rounded-full bg-asha-red-soft px-3.5 py-1.5 text-sm font-bold text-asha-red">
                {s.highRiskCount(overview.counts.highRisk)}
              </span>
            )}
            {overview.counts.alertsSent > 0 && (
              <span className="rounded-full bg-asha-mint px-3.5 py-1.5 text-sm font-semibold text-asha-teal">
                {s.alertsSent(overview.counts.alertsSent)}
              </span>
            )}
            {dueNow > 0 && (
              <button
                type="button"
                onClick={() => setTab('schedule')}
                className="rounded-full bg-asha-amber px-3.5 py-1.5 text-sm font-bold text-[#7A4E0A] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
              >
                {s.schedDue(dueNow)}
              </button>
            )}
          </div>
        )}

        {/* 3-Tab Navigation */}
        <TabBar
          tabs={tabs}
          value={tab}
          onChange={setTab}
          ariaLabel="Workspace sections"
          idPrefix="asha-workspace-tab"
          className="grid w-full max-w-md"
        />

        {/* Tab 1: Home (Talk) */}
        {tab === 'home' && (
          <section
            role="tabpanel"
            aria-labelledby="asha-workspace-tab-home"
            className="flex flex-1 flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6"
          >
            {/* Mobile compact "Up next today" strip */}
            {upNextTotal > 0 && (
              <div className="rounded-2xl border border-asha-line bg-white p-4 lg:hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-asha-teal" aria-hidden />
                    <span className="text-base font-extrabold text-asha-ink">Up next today</span>
                    <span className="rounded-full bg-asha-red-soft px-2 py-0.5 text-xs font-bold text-asha-red">
                      {upNextTotal}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab(upNextSchedule.length > 0 ? 'schedule' : 'patients')}
                    className="inline-flex items-center gap-1 text-sm font-bold text-asha-teal hover:underline"
                  >
                    See all
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {upNextSchedule[0] && (
                  <button
                    type="button"
                    onClick={() => handleSelectScheduleItem(upNextSchedule[0]!)}
                    className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl bg-asha-cream px-3 py-2 text-left text-sm transition-colors hover:bg-asha-sand"
                  >
                    <span className="truncate font-bold text-asha-ink">
                      {upNextSchedule[0].beneficiary.name}
                      {upNextSchedule[0].beneficiary.village ? ` · ${upNextSchedule[0].beneficiary.village}` : ''}
                    </span>
                    <span className={cn('shrink-0 font-bold', upNextSchedule[0].status === 'overdue' ? 'text-asha-red' : 'text-asha-teal')}>
                      {upNextSchedule[0].status === 'overdue' ? s.schedOverdue : s.schedToday}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Left Column: Talk to Saathi */}
            <div className="flex flex-col items-center gap-5 lg:col-span-6">
              <div className="flex w-full flex-col items-center rounded-3xl border border-asha-line bg-white px-6 py-8 text-center">
                <h2 className="text-xl font-extrabold text-asha-ink sm:text-2xl">{s.stepStart}</h2>
                <p className="mt-1 max-w-sm text-sm text-asha-muted">{s.startTagline}</p>

                <div className="mt-6">
                  <SaathiAvatar
                    state={isStartingCall ? 'connecting' : playingVoice ? 'talking' : 'idle'}
                    label={isStartingCall ? s.connecting : s.startButton}
                    onClick={onStartCall}
                    disabled={isStartingCall}
                  />
                </div>

                {isStartingCall && (
                  <div className="mt-4">
                    <ConnectingGreetings words={language === 'auto' ? Object.values(HELLO) : [HELLO[uiLang]]} />
                  </div>
                )}

                {callError && (
                  <p role="alert" className="mt-4 w-full rounded-2xl bg-asha-red-soft px-4 py-3 text-sm font-medium text-asha-red">
                    {callError}
                  </p>
                )}
              </div>

              <GoodToKnow s={s} className="w-full" />
            </div>

            {/* Right Column (Desktop): Up next today */}
            <div className="hidden lg:col-span-6 lg:block">
              <div className="rounded-3xl border border-asha-line bg-white p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <CalendarClock className="h-5 w-5 text-asha-teal" aria-hidden />
                    <h2 className="text-xl font-extrabold text-asha-ink">Up next today</h2>
                  </div>
                  {upNextTotal > 0 && (
                    <span className="rounded-full bg-asha-red-soft px-2.5 py-0.5 text-sm font-bold text-asha-red">
                      {upNextTotal}
                    </span>
                  )}
                </div>

                {isOverviewLoading && !overview ? (
                  <div className="mt-4 space-y-3">
                    <div className="h-16 animate-pulse rounded-2xl bg-asha-sand/70" />
                    <div className="h-16 animate-pulse rounded-2xl bg-asha-sand/70" />
                  </div>
                ) : upNextTotal === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-asha-line bg-asha-cream/60 px-5 py-8 text-center">
                    <CheckCircle2 className="mx-auto h-9 w-9 text-asha-teal" aria-hidden />
                    <p className="mt-2 text-base font-bold text-asha-ink">All caught up for today</p>
                    <p className="mt-1 text-sm text-asha-muted">
                      No overdue follow-ups or pending high-risk mothers right now.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {upNextSchedule.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-asha-muted">
                          Scheduled visits due
                        </p>
                        <ul className="space-y-2">
                          {upNextSchedule.slice(0, 4).map((item) => {
                            const isOverdue = item.status === 'overdue';
                            return (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectScheduleItem(item)}
                                  className={cn(
                                    'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors hover:border-asha-teal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal',
                                    isOverdue ? 'border-asha-red/30 bg-asha-red-soft' : 'border-asha-line bg-asha-cream/50',
                                  )}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-base font-bold text-asha-ink">{item.beneficiary.name}</p>
                                    <p className="truncate text-sm text-asha-muted">
                                      {[item.beneficiary.village, item.reason].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className={cn('text-sm font-bold', isOverdue ? 'text-asha-red' : 'text-asha-teal')}>
                                      {isOverdue ? s.schedOverdue : s.schedToday}
                                    </p>
                                    <p className="text-xs text-asha-muted">{formatDueDate(item.dueDate, uiLang)}</p>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {pendingHighRisk.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-asha-red">
                          High-risk mothers not yet visited today
                        </p>
                        <ul className="space-y-2">
                          {pendingHighRisk.slice(0, 3).map((patient) => {
                            const badge = getPatientBadge(patient);
                            return (
                              <li key={patient.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedPatient(patient)}
                                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-asha-red/25 bg-asha-red-soft/60 px-4 py-3 text-left transition-colors hover:border-asha-red/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-base font-bold text-asha-ink">{patient.name}</p>
                                    <p className="truncate text-sm text-asha-muted">
                                      {[
                                        patient.village,
                                        patient.gestationWeeks !== null ? s.weeksN(patient.gestationWeeks) : null,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  </div>
                                  <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', badge.className)}>
                                    {badge.label}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2 border-t border-asha-line pt-4">
                  <button
                    type="button"
                    onClick={() => setTab('schedule')}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-asha-line bg-asha-cream px-4 text-sm font-bold text-asha-ink transition-colors hover:bg-asha-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
                  >
                    See full schedule
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('patients')}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-asha-line bg-asha-cream px-4 text-sm font-bold text-asha-ink transition-colors hover:bg-asha-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
                  >
                    See all patients
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab 2: Schedule */}
        {tab === 'schedule' && (
          <section role="tabpanel" aria-labelledby="asha-workspace-tab-schedule" className="max-w-3xl">
            {isOverviewLoading && !overview ? (
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-2xl bg-asha-sand/70" />
                <div className="h-16 animate-pulse rounded-2xl bg-asha-sand/70" />
                <div className="h-16 animate-pulse rounded-2xl bg-asha-sand/70" />
              </div>
            ) : (
              <SchedulePanel
                schedule={schedule}
                s={s}
                lang={uiLang}
                onSelectItem={handleSelectScheduleItem}
              />
            )}
          </section>
        )}

        {/* Tab 3: Patients */}
        {tab === 'patients' && (
          <section role="tabpanel" aria-labelledby="asha-workspace-tab-patients" className="space-y-4">
            {/* Search + Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-sm">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-asha-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search mother or village…"
                  aria-label="Search patients by name or village"
                  className="h-11 w-full rounded-full border border-asha-line bg-white pl-10 pr-4 text-base text-asha-ink placeholder:text-asha-muted focus:border-asha-teal focus:outline-none focus:ring-2 focus:ring-asha-teal/30"
                />
              </div>

              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter patients">
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'high_risk', label: 'High risk' },
                    { key: 'pending', label: 'Pending today' },
                    { key: 'visited', label: 'Visited' },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setPatientFilter(chip.key)}
                    aria-pressed={patientFilter === chip.key}
                    className={cn(
                      'h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal',
                      patientFilter === chip.key
                        ? 'border-asha-teal bg-asha-teal text-white'
                        : 'border-asha-line bg-white text-asha-ink hover:bg-asha-sand',
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Patient Cards */}
            {isOverviewLoading && !overview ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-28 animate-pulse rounded-2xl bg-asha-sand/70" />
                <div className="h-28 animate-pulse rounded-2xl bg-asha-sand/70" />
                <div className="h-28 animate-pulse rounded-2xl bg-asha-sand/70" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-asha-line bg-white/60 px-6 py-10 text-center">
                <Users className="h-10 w-10 text-asha-teal" aria-hidden />
                <p className="text-base font-semibold text-asha-ink">No mothers match this filter.</p>
                {(searchQuery || patientFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setPatientFilter('all');
                    }}
                    className="rounded-full border border-asha-line bg-white px-4 py-1.5 text-sm font-bold text-asha-teal hover:bg-asha-sand"
                  >
                    Show all patients
                  </button>
                )}
              </div>
            ) : (
              <ul className="grid gap-3 pb-4 sm:grid-cols-2">
                {filteredPatients.map((patient) => {
                  const badge = getPatientBadge(patient);
                  const latest = patient.latestVisit;
                  const metaParts = [
                    patient.village,
                    patient.gestationWeeks !== null ? s.weeksN(patient.gestationWeeks) : null,
                    patient.age !== null ? `Age ${patient.age}` : null,
                    formatParity(patient.parity),
                  ].filter(Boolean);

                  const vitalsParts: string[] = [];
                  if (latest?.bpSys !== null && latest?.bpSys !== undefined && latest.bpDia !== null) {
                    vitalsParts.push(`BP ${latest.bpSys}/${latest.bpDia}`);
                  }
                  if (latest?.hb !== null && latest?.hb !== undefined) {
                    vitalsParts.push(`Hb ${latest.hb}`);
                  }

                  return (
                    <li key={patient.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(patient)}
                        className="flex h-full w-full flex-col justify-between gap-3 rounded-2xl border border-asha-line bg-white p-4 text-left transition-colors hover:border-asha-teal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-extrabold text-asha-ink">{patient.name}</p>
                            <p className="mt-0.5 text-sm text-asha-muted">{metaParts.join(' · ')}</p>
                          </div>
                          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', badge.className)}>
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-asha-line/70 pt-2.5 text-sm">
                          <span className="font-medium text-asha-ink/80">
                            {vitalsParts.length > 0 ? vitalsParts.join(' · ') : 'No vitals recorded yet'}
                          </span>
                          {patient.visitedToday && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-asha-mint px-2.5 py-0.5 text-xs font-bold text-asha-teal">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                              Visited today
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          lang={uiLang}
          weeksLabel={s.weeksN}
          isStartingCall={isStartingCall}
          onClose={() => setSelectedPatient(null)}
          onTalkToSaathi={handleTalkFromModal}
        />
      )}

      {/* Language & Voice Modal */}
      {isVoiceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-asha-night/40 p-0 sm:items-center sm:p-4"
          onClick={() => setIsVoiceModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Language and voice settings"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-asha-cream p-6 shadow-xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold text-asha-ink">Language &amp; Voice</h2>
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(false)}
                aria-label="Close settings"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-asha-sand text-asha-ink hover:bg-asha-line"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <p className="mb-2.5 text-sm font-bold text-asha-muted">{s.callLanguage}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={s.callLanguage}>
                  {LANGUAGE_ORDER.map((code) => (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={language === code}
                      onClick={() => onLanguageChange(code)}
                      className={cn(
                        'h-10 rounded-full border px-4 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal',
                        language === code
                          ? 'border-asha-teal bg-asha-teal text-white'
                          : 'border-asha-line bg-white text-asha-ink hover:bg-asha-sand',
                      )}
                    >
                      {LANGUAGES[code].native}
                    </button>
                  ))}
                </div>
                {(LANGUAGES[language].standIn || language === 'auto') && (
                  <p className="mt-2 text-xs text-asha-muted">
                    {language === 'auto' ? s.autoNote : s.betaNote}
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2.5 text-sm font-bold text-asha-muted">{s.voiceLabel}</p>
                <VoicePicker
                  voices={VOICES[language]}
                  value={voice}
                  onChange={onVoiceChange}
                  s={s}
                  playingId={playingVoice}
                />
              </div>

              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(false)}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-asha-teal px-6 text-base font-bold text-white transition-colors hover:bg-asha-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PatientDetailModalProps {
  patient: PatientSummary;
  lang: string;
  weeksLabel: (n: number) => string;
  isStartingCall: boolean;
  onClose: () => void;
  onTalkToSaathi: () => void;
}

function PatientDetailModal({
  patient,
  lang,
  weeksLabel,
  isStartingCall,
  onClose,
  onTalkToSaathi,
}: PatientDetailModalProps) {
  const badge = getPatientBadge(patient);
  const details = [
    patient.village,
    patient.age !== null ? `Age ${patient.age}` : null,
    patient.gestationWeeks !== null ? weeksLabel(patient.gestationWeeks) : null,
    formatParity(patient.parity),
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-asha-night/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={patient.name}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-asha-cream shadow-xl sm:rounded-3xl"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-asha-line bg-white px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-extrabold text-asha-ink">{patient.name}</h2>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', badge.className)}>
                {badge.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-asha-muted">{details.join(' · ')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close patient details"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-asha-sand text-asha-ink hover:bg-asha-line"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Next Follow-up */}
          {patient.nextFollowUp && (
            <div
              className={cn(
                'rounded-2xl border px-4 py-3.5',
                patient.nextFollowUp.status === 'overdue'
                  ? 'border-asha-red/30 bg-asha-red-soft'
                  : 'border-asha-line bg-white',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-asha-muted">
                  Next follow-up
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-bold',
                    patient.nextFollowUp.status === 'overdue'
                      ? 'bg-asha-red text-white'
                      : patient.nextFollowUp.status === 'today'
                        ? 'bg-asha-amber text-[#7A4E0A]'
                        : 'bg-asha-mint text-asha-teal',
                  )}
                >
                  {patient.nextFollowUp.status === 'overdue'
                    ? 'Overdue'
                    : patient.nextFollowUp.status === 'today'
                      ? 'Due today'
                      : 'Upcoming'}
                </span>
              </div>
              <p className="mt-1 text-base font-bold text-asha-ink">
                {formatDueDate(patient.nextFollowUp.dueDate, lang)}
              </p>
              {patient.nextFollowUp.reason && (
                <p className="mt-0.5 text-sm text-asha-muted">{patient.nextFollowUp.reason}</p>
              )}
            </div>
          )}

          {/* Past Visits */}
          <div>
            <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wide text-asha-muted">
              Past visits
            </h3>
            {patient.recentVisits.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-asha-line bg-white/70 px-4 py-6 text-center text-sm text-asha-muted">
                No visits recorded yet. Start a conversation with Saathi to record her first visit.
              </div>
            ) : (
              <ul className="space-y-3">
                {patient.recentVisits.map((visit) => (
                  <VisitHistoryRow key={visit.id} visit={visit} lang={lang} />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sticky Footer CTA */}
        <div className="border-t border-asha-line bg-white px-6 py-4">
          <button
            type="button"
            disabled={isStartingCall}
            onClick={onTalkToSaathi}
            className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-full bg-asha-orange px-6 py-3 text-base font-bold text-asha-night transition-colors hover:bg-[#E8863C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-orange/50 disabled:opacity-70"
          >
            <Mic className="h-5 w-5" aria-hidden />
            Talk to Saathi
          </button>
        </div>
      </div>
    </div>
  );
}

function VisitHistoryRow({ visit, lang }: { visit: PatientVisitSummary; lang: string }) {
  const badge = RISK_STYLES[visit.riskLevel];
  return (
    <li className="rounded-2xl border border-asha-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-asha-ink">{formatVisitDate(visit.visitedAt, lang)}</span>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', badge.className)}>
          {badge.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <span className="rounded-lg bg-asha-cream px-2.5 py-1 font-semibold text-asha-ink">
          BP: {visit.bpSys !== null && visit.bpDia !== null ? `${visit.bpSys}/${visit.bpDia}` : '—'}
        </span>
        <span className="rounded-lg bg-asha-cream px-2.5 py-1 font-semibold text-asha-ink">
          Hb: {visit.hb !== null ? visit.hb : '—'}
        </span>
        {visit.gestationWeeks !== null && (
          <span className="rounded-lg bg-asha-cream px-2.5 py-1 font-semibold text-asha-ink">
            {visit.gestationWeeks} wks
          </span>
        )}
      </div>

      {visit.symptoms.length > 0 && (
        <p className="mt-2 text-sm text-asha-muted">
          Symptoms: {visit.symptoms.map((sym) => sym.replace(/_/g, ' ')).join(', ')}
        </p>
      )}

      {visit.riskReasons.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-asha-line/60 pt-2">
          {visit.riskReasons.map((reason) => (
            <li key={reason.code} className="text-sm font-medium text-asha-ink/90">
              • {reason.text}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
