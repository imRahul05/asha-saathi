'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Bell,
  CalendarClock,
  Check,
  Clock,
  LogOut,
  Phone,
  RefreshCw,
  Search,
  Stethoscope,
  TriangleAlert,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { WebCallOverlay } from '@/components/call/WebCallOverlay';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { useDoctorOverview } from '@/hooks/use-doctor-overview';
import { useWebCalling } from '@/hooks/use-web-calling';
import { clearOfflineCache } from '@/lib/offline-cache';
import { dueNowCount, formatDueDate, todayInIndia } from '@/lib/asha/schedule';
import type { UseWebCallingResult } from '@/lib/call/signaling-types';
import type { DoctorOverview, DoctorVisitCase, PatientSummary, PatientVisitSummary } from '@/lib/overview-types';
import type { RiskLevel, SnapshotEvent, SnapshotVisit } from '@/lib/snapshot-types';
import type { Strings, UiLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RiskResult } from './RiskResult';
import { SchedulePanel } from './SchedulePanel';
import { TabBar, type TabDef } from './TabBar';

type DashboardTab = 'cases' | 'patients' | 'schedule' | 'activity';
type CaseFilter = 'all' | 'high' | 'alerts';
type PatientFilter = 'all' | 'high_risk' | 'pending_today' | 'visited_today';

interface DashboardProps {
  isDoctorSession?: boolean;
  dashboardKey?: string | null;
}

const RISK_BADGE_STYLE: Record<RiskLevel, string> = {
  urgent: 'bg-asha-red text-white',
  high: 'bg-asha-red-soft text-asha-red border border-asha-red/25',
  watch: 'bg-asha-amber/20 text-[#8A5A00] border border-asha-amber/40',
  normal: 'bg-asha-mint text-asha-teal border border-asha-teal/20',
};

const RISK_LABEL: Record<RiskLevel, string> = {
  urgent: 'URGENT',
  high: 'HIGH',
  watch: 'WATCH',
  normal: 'NORMAL',
};

function toSnapshotVisit(visitCase: DoctorVisitCase): SnapshotVisit {
  return {
    id: visitCase.id,
    visitedAt: visitCase.visitedAt,
    beneficiary: {
      name: visitCase.beneficiary.name,
      village: visitCase.beneficiary.village,
      weeks: visitCase.beneficiary.weeks,
      age: visitCase.beneficiary.age,
      firstPregnancy: visitCase.beneficiary.firstPregnancy,
    },
    vitals: visitCase.vitals,
    risk: visitCase.risk,
    alert: visitCase.alert,
    call: visitCase.call,
    alertHeld: visitCase.alertHeld,
    doctor: visitCase.doctor,
    followUp: visitCase.followUp,
  };
}

function formatIndiaDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function formatIndiaDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function formatIndiaTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function formatBp(bpSys: number | null, bpDia: number | null): string {
  if (bpSys == null) return '—';
  return bpDia != null ? `${bpSys}/${bpDia}` : String(bpSys);
}

function formatHb(hb: number | null): string {
  return hb != null ? `${hb} g/dL` : '—';
}

function isHighRisk(level: RiskLevel): boolean {
  return level === 'high' || level === 'urgent';
}

function formatAlertChannel(channel: string | null): string {
  if (channel === 'telegram') return 'Telegram';
  if (channel === 'twilio-whatsapp') return 'WhatsApp';
  if (channel === 'twilio-sms') return 'SMS';
  if (channel === 'console') return 'Dashboard';
  return channel ?? 'Dashboard';
}

export function Dashboard({ isDoctorSession = false, dashboardKey = null }: DashboardProps) {
  const router = useRouter();
  const { s, uiLang } = useLanguage();
  const { overview, error, isLoading, isOffline, cachedAt, refresh } = useDoctorOverview(dashboardKey);
  const calling = useWebCalling({ enabled: isDoctorSession });
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await Promise.all([
        clearOfflineCache(),
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined),
      ]);
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const isEmptyDatabase = Boolean(
    overview && !overview.asha && overview.cases.length === 0 && overview.patients.length === 0,
  );

  return (
    <div className="min-h-dvh bg-asha-cream px-4 py-5 text-asha-ink sm:px-8 sm:py-8">
      <WebCallOverlay calling={calling} />
      <Header
        overview={overview}
        isDoctorSession={isDoctorSession}
        calling={calling}
        isSigningOut={isSigningOut}
        onRefresh={refresh}
        onSignOut={() => {
          void handleSignOut();
        }}
      />

      <main className="mx-auto mt-6 max-w-7xl">
        {isOffline && overview && (
          <div
            role="status"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-asha-amber/60 bg-asha-amber/40 px-4 py-2.5 text-sm text-[#7A4E0A]"
          >
            <div className="flex items-center gap-2 font-medium">
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                Offline — showing last saved PHC data
                {cachedAt ? ` (${formatIndiaDateTime(cachedAt)})` : ''}. Will refresh automatically when online.
              </span>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#7A4E0A] shadow-sm hover:bg-asha-cream"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </button>
          </div>
        )}
        {error === 'UNAUTHORIZED' ? (
          <Notice
            title="Doctor sign-in required"
            body="Sign in with a PHC Doctor account to review cases and alerts, or open this view with /dashboard?key=…."
            action={
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-asha-teal px-6 py-3 text-base font-bold text-white transition-colors hover:bg-asha-teal-dark"
              >
                Sign in as Doctor
              </Link>
            }
          />
        ) : error === 'FORBIDDEN' ? (
          <Notice
            title="Doctor access required"
            body="You are currently signed in with an ASHA worker account. Sign in as a PHC Doctor to open the clinical dashboard."
            action={
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-asha-teal px-6 py-3 text-base font-bold text-white transition-colors hover:bg-asha-teal-dark"
              >
                Sign in as Doctor
              </Link>
            }
          />
        ) : error === 'DATABASE_NOT_CONFIGURED' ? (
          <Notice
            title="The database is not connected"
            body="Add DATABASE_URL, then run pnpm db:migrate and pnpm db:seed."
          />
        ) : error && !overview ? (
          <Notice
            title="Could not load clinical data"
            body={`Reason: ${error}. The dashboard will keep retrying automatically.`}
            action={
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-full bg-asha-teal px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-asha-teal-dark"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Retry now
              </button>
            }
          />
        ) : isLoading && !overview ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-asha-line bg-white p-10 text-center">
            <p className="text-lg font-bold text-asha-ink">Loading clinical dashboard…</p>
            <p className="mt-1 text-sm text-asha-muted">Fetching PHC cases, alerts, and patient records.</p>
          </div>
        ) : !overview || isEmptyDatabase ? (
          <Notice
            title="No PHC data is set up yet"
            body="Run pnpm db:seed to create the initial ASHA worker, PHC doctor, and registered mothers."
          />
        ) : (
          <ClinicalWorkspace
            overview={overview}
            isDoctorSession={isDoctorSession}
            calling={calling}
            error={error}
            s={s}
            uiLang={uiLang}
          />
        )}
      </main>
    </div>
  );
}

function Header({
  overview,
  isDoctorSession,
  calling,
  isSigningOut,
  onRefresh,
  onSignOut,
}: {
  overview: DoctorOverview | null;
  isDoctorSession: boolean;
  calling: UseWebCallingResult;
  isSigningOut: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const lastEvent = overview?.events[overview.events.length - 1];
  const isLive = Boolean(
    overview &&
      lastEvent &&
      new Date(overview.serverTime).getTime() - new Date(lastEvent.at).getTime() < 2 * 60_000,
  );

  const subtitleParts: string[] = [];
  if (overview) {
    subtitleParts.push(overview.doctor.name);
    subtitleParts.push(overview.doctor.phcName);
    if (overview.asha) {
      subtitleParts.push(`ASHA: ${overview.asha.name}`);
    }
  }
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : 'Doctor Dashboard';

  return (
    <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <BrandMark className="h-12 w-12 shrink-0" />
        <div>
          <h1 className="font-display text-2xl font-extrabold leading-7 text-asha-ink">ASHA Saathi</h1>
          <p className="text-sm font-medium text-asha-muted">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-2 rounded-full border border-asha-line bg-white px-4 py-2 text-sm font-semibold text-asha-ink">
          <span
            className={cn('h-2.5 w-2.5 rounded-full', isLive ? 'bg-asha-red' : 'bg-asha-line')}
            aria-hidden
          />
          {isLive ? 'Live call' : 'Standby'}
        </span>

        {isDoctorSession && (calling.isPeerOnline || calling.isRtmConnected) && (
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold',
              calling.isPeerOnline
                ? 'border-asha-teal/30 bg-asha-mint text-asha-teal'
                : 'border-asha-line bg-white text-asha-muted',
            )}
            title={
              calling.isPeerOnline
                ? 'ASHA worker is online and ready for instant web calls'
                : 'Connected for live web calls'
            }
          >
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                calling.isPeerOnline ? 'bg-emerald-500' : 'bg-asha-teal/50',
              )}
              aria-hidden
            />
            {calling.isPeerOnline ? 'ASHA online' : 'Ready for calls'}
          </span>
        )}

        <button
          type="button"
          onClick={onRefresh}
          title="Refresh clinical data"
          aria-label="Refresh clinical data"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-asha-line bg-white text-asha-muted transition-colors hover:border-asha-teal/40 hover:text-asha-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-teal/30"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
        </button>

        {isDoctorSession && (
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="inline-flex items-center gap-2 rounded-full border border-asha-line bg-white px-4 py-2 text-sm font-bold text-asha-ink transition-colors hover:border-asha-red/40 hover:bg-asha-red-soft hover:text-asha-red disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        )}
      </div>
    </header>
  );
}

function ClinicalWorkspace({
  overview,
  isDoctorSession,
  calling,
  error,
  s,
  uiLang,
}: {
  overview: DoctorOverview;
  isDoctorSession: boolean;
  calling: UseWebCallingResult;
  error: string | null;
  s: Strings;
  uiLang: UiLang;
}) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('cases');
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  const recentSyncedAlert = useMemo(() => {
    const serverMs = new Date(overview.serverTime).getTime();
    if (Number.isNaN(serverMs)) return null;
    const tenMinutesMs = 10 * 60_000;
    let newest: DoctorVisitCase | null = null;
    let newestMs = -Infinity;

    for (const visitCase of overview.cases) {
      if (visitCase.alert?.status !== 'sent') continue;
      if (dismissedAlertIds.includes(visitCase.id)) continue;
      const alertTimeIso = visitCase.alert.sentAt ?? visitCase.visitedAt;
      const alertMs = new Date(alertTimeIso).getTime();
      if (Number.isNaN(alertMs)) continue;
      if (serverMs - alertMs <= tenMinutesMs && alertMs > newestMs) {
        newest = visitCase;
        newestMs = alertMs;
      }
    }
    return newest;
  }, [overview.cases, overview.serverTime, dismissedAlertIds]);

  const dueNow = useMemo(
    () => dueNowCount(overview.schedule, todayInIndia()),
    [overview.schedule],
  );

  const highRiskCasesCount = useMemo(
    () => overview.cases.filter((c) => isHighRisk(c.risk.level)).length,
    [overview.cases],
  );

  const tabs: TabDef<DashboardTab>[] = useMemo(
    () => [
      {
        key: 'cases',
        label: (
          <span className="inline-flex items-center gap-1.5 truncate">
            <Stethoscope className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Cases &amp; Alerts</span>
          </span>
        ),
        badge:
          highRiskCasesCount > 0 ? (
            <span className="rounded-full bg-asha-red-soft px-2 py-0.5 text-xs font-extrabold text-asha-red">
              {highRiskCasesCount}
            </span>
          ) : overview.cases.length > 0 ? (
            <span className="rounded-full bg-asha-sand px-2 py-0.5 text-xs font-bold text-asha-ink">
              {overview.cases.length}
            </span>
          ) : undefined,
      },
      {
        key: 'patients',
        label: (
          <span className="inline-flex items-center gap-1.5 truncate">
            <Users className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Patients</span>
          </span>
        ),
        badge: (
          <span className="rounded-full bg-asha-sand px-2 py-0.5 text-xs font-bold text-asha-ink">
            {overview.counts.totalPatients}
          </span>
        ),
      },
      {
        key: 'schedule',
        label: (
          <span className="inline-flex items-center gap-1.5 truncate">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Follow-ups</span>
          </span>
        ),
        badge:
          dueNow > 0 ? (
            <span className="rounded-full bg-asha-red px-2 py-0.5 text-xs font-extrabold text-white">
              {dueNow}
            </span>
          ) : undefined,
      },
      {
        key: 'activity',
        label: (
          <span className="inline-flex items-center gap-1.5 truncate">
            <Activity className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">AI Activity</span>
          </span>
        ),
        badge:
          overview.events.length > 0 ? (
            <span className="rounded-full bg-asha-sand px-2 py-0.5 text-xs font-bold text-asha-muted">
              {overview.events.length}
            </span>
          ) : undefined,
      },
    ],
    [dueNow, highRiskCasesCount, overview.cases.length, overview.counts.totalPatients, overview.events.length],
  );

  return (
    <div className="space-y-6">
      {recentSyncedAlert && (
        <div
          role="status"
          className={cn(
            'rounded-3xl border p-4 shadow-sm sm:px-5',
            isHighRisk(recentSyncedAlert.risk.level)
              ? 'border-asha-red/30 bg-asha-red-soft'
              : 'border-asha-teal/30 bg-asha-mint/70',
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-extrabold text-asha-teal shadow-xs">
                  <Bell className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  New alert synced with {formatAlertChannel(recentSyncedAlert.alert?.channel ?? null)}
                </span>
                <RiskPill level={recentSyncedAlert.risk.level} />
                <span className="text-xs font-medium text-asha-muted">
                  {formatIndiaTime(recentSyncedAlert.alert?.sentAt ?? recentSyncedAlert.visitedAt)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-display text-base font-extrabold text-asha-ink">
                  {recentSyncedAlert.beneficiary.name}
                </span>
                {recentSyncedAlert.beneficiary.village && (
                  <span className="text-asha-muted">{recentSyncedAlert.beneficiary.village}</span>
                )}
                <span className="rounded-lg bg-white/90 px-2 py-0.5 text-xs font-bold text-asha-ink">
                  BP {formatBp(recentSyncedAlert.vitals.bpSys, recentSyncedAlert.vitals.bpDia)}
                </span>
                <span className="rounded-lg bg-white/90 px-2 py-0.5 text-xs font-bold text-asha-ink">
                  Hb {formatHb(recentSyncedAlert.vitals.hb)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCaseFilter('all');
                  setSelectedCaseId(recentSyncedAlert.id);
                  setActiveTab('cases');
                }}
                className="inline-flex h-9 items-center rounded-full border border-asha-line bg-white px-3.5 text-xs font-bold text-asha-ink transition-colors hover:border-asha-teal/40 hover:bg-asha-cream"
              >
                View case
              </button>
              {isDoctorSession && (
                <button
                  type="button"
                  onClick={() => {
                    void calling.startCall({
                      visitId: recentSyncedAlert.id,
                      patientName: recentSyncedAlert.beneficiary.name,
                      patientVillage: recentSyncedAlert.beneficiary.village,
                      riskLevel: recentSyncedAlert.risk.level,
                    });
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-asha-teal px-3.5 text-xs font-bold text-white transition-colors hover:bg-asha-teal-dark"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Call ASHA
                </button>
              )}
              <button
                type="button"
                onClick={() => setDismissedAlertIds((prev) => [...prev, recentSyncedAlert.id])}
                aria-label="Dismiss synced alert notification"
                title="Dismiss"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-asha-muted transition-colors hover:bg-white hover:text-asha-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-asha-red/30 bg-asha-red-soft px-4 py-2.5 text-sm font-semibold text-asha-red"
        >
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          Live sync interrupted ({error}). Showing last received data and retrying automatically.
        </div>
      )}

      {/* Top KPI Strip */}
      <section aria-label="Clinical summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="High / Urgent risk" value={overview.counts.highRisk} tone="red" />
        <Stat label="Alerts sent" value={overview.counts.alertsSent} />
        <Stat label="Visits today" value={overview.counts.visits} />
        <Stat label="Overdue follow-ups" value={overview.counts.overdueFollowUps} tone="red" />
      </section>

      {/* Navigation Tabs */}
      <div className="overflow-x-auto pb-1">
        <TabBar
          tabs={tabs}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Doctor dashboard sections"
          idPrefix="doctor-tab"
          className="grid min-w-[34rem] sm:min-w-0 sm:max-w-3xl"
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'cases' && (
        <CasesTab
          cases={overview.cases}
          events={overview.events}
          isDoctorSession={isDoctorSession}
          calling={calling}
          filter={caseFilter}
          onFilterChange={setCaseFilter}
          selectedCaseId={selectedCaseId}
          onSelectCaseId={setSelectedCaseId}
          s={s}
          uiLang={uiLang}
          onOpenPatients={() => setActiveTab('patients')}
        />
      )}

      {activeTab === 'patients' && (
        <PatientsTab patients={overview.patients} uiLang={uiLang} />
      )}

      {activeTab === 'schedule' && (
        <section
          aria-label="Scheduled follow-ups"
          className="rounded-3xl border border-asha-line bg-white p-5 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-extrabold text-asha-ink">Follow-up Schedule</h2>
              <p className="text-sm text-asha-muted">
                Pending ANC follow-ups across the PHC, grouped by urgency.
              </p>
            </div>
            <span className="rounded-full bg-asha-sand px-3 py-1 text-sm font-bold text-asha-ink">
              {overview.schedule.length} scheduled
            </span>
          </div>
          <SchedulePanel schedule={overview.schedule} s={s} lang={uiLang} />
        </section>
      )}

      {activeTab === 'activity' && <ActivityTab events={overview.events} />}
    </div>
  );
}

function CasesTab({
  cases,
  events,
  isDoctorSession,
  calling,
  filter,
  onFilterChange,
  selectedCaseId,
  onSelectCaseId,
  s,
  uiLang,
  onOpenPatients,
}: {
  cases: DoctorVisitCase[];
  events: SnapshotEvent[];
  isDoctorSession: boolean;
  calling: UseWebCallingResult;
  filter: CaseFilter;
  onFilterChange: (next: CaseFilter) => void;
  selectedCaseId: string | null;
  onSelectCaseId: (id: string | null) => void;
  s: Strings;
  uiLang: UiLang;
  onOpenPatients: () => void;
}) {
  const highCount = useMemo(() => cases.filter((c) => isHighRisk(c.risk.level)).length, [cases]);
  const alertsCount = useMemo(() => cases.filter((c) => c.alert !== null || c.alertHeld).length, [cases]);

  const filteredCases = useMemo(() => {
    if (filter === 'high') return cases.filter((c) => isHighRisk(c.risk.level));
    if (filter === 'alerts') return cases.filter((c) => c.alert !== null || c.alertHeld);
    return cases;
  }, [cases, filter]);

  const selectedCase = useMemo(() => {
    if (filteredCases.length === 0) return null;
    if (selectedCaseId) {
      const match = filteredCases.find((c) => c.id === selectedCaseId);
      if (match) return match;
    }
    return filteredCases[0];
  }, [filteredCases, selectedCaseId]);

  const isRingingSelectedCase =
    selectedCase !== null &&
    calling.outgoingCall?.status === 'ringing' &&
    calling.outgoingCall.summary.visitId === selectedCase.id;

  if (cases.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-asha-line bg-white/75 p-10 text-center">
        <p className="font-display text-xl font-extrabold text-asha-ink">No visits recorded yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-asha-muted">
          When an ASHA worker records an ANC visit, the risk assessment, vitals, and PHC alert appear here immediately.
        </p>
        <button
          type="button"
          onClick={onOpenPatients}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-asha-teal px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-asha-teal-dark"
        >
          <Users className="h-4 w-4" aria-hidden />
          Inspect registered patients
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter cases">
        <FilterChip
          active={filter === 'all'}
          onClick={() => onFilterChange('all')}
          label="All cases"
          count={cases.length}
        />
        <FilterChip
          active={filter === 'high'}
          onClick={() => onFilterChange('high')}
          label="High / Urgent"
          count={highCount}
          tone="red"
        />
        <FilterChip
          active={filter === 'alerts'}
          onClick={() => onFilterChange('alerts')}
          label="Alerts"
          count={alertsCount}
        />
      </div>

      {filteredCases.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-asha-line bg-white/75 p-8 text-center">
          <p className="text-lg font-extrabold text-asha-ink">No cases match this filter</p>
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className="mt-3 rounded-full border border-asha-line bg-white px-4 py-2 text-sm font-bold text-asha-teal hover:bg-asha-mint/40"
          >
            Show all cases
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(20rem,24rem)_1fr]">
          {/* Left Queue */}
          <section aria-label="Clinical case queue" className="space-y-2.5">
            {filteredCases.map((visitCase) => {
              const isSelected = selectedCase?.id === visitCase.id;
              return (
                <button
                  key={visitCase.id}
                  type="button"
                  onClick={() => {
                    onSelectCaseId(visitCase.id);
                  }}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-teal/30',
                    isSelected
                      ? 'border-asha-teal bg-white shadow-sm ring-2 ring-asha-teal/15'
                      : 'border-asha-line bg-white/80 hover:border-asha-teal/40 hover:bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-asha-ink">
                        {visitCase.beneficiary.name}
                      </p>
                      <p className="truncate text-xs font-medium text-asha-muted">
                        {[
                          visitCase.beneficiary.village,
                          visitCase.beneficiary.weeks != null ? `${visitCase.beneficiary.weeks}w` : null,
                          `ASHA: ${visitCase.ashaName}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <RiskPill level={visitCase.risk.level} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-lg bg-asha-sand px-2.5 py-1 text-asha-ink">
                      BP {formatBp(visitCase.vitals.bpSys, visitCase.vitals.bpDia)}
                    </span>
                    <span className="rounded-lg bg-asha-sand px-2.5 py-1 text-asha-ink">
                      Hb {formatHb(visitCase.vitals.hb)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <AlertBadge visitCase={visitCase} />
                    <span className="font-medium text-asha-muted">
                      {formatIndiaDateTime(visitCase.visitedAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </section>

          {/* Right Clinical Detail */}
          {selectedCase && (
            <div className="min-w-0 space-y-5">
              {/* Action Bar */}
              <section className="rounded-3xl border border-asha-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-display text-2xl font-extrabold text-asha-ink">
                        {selectedCase.beneficiary.name}
                      </h2>
                      <RiskPill level={selectedCase.risk.level} />
                    </div>
                    <p className="mt-1 text-sm text-asha-muted">
                      {[
                        selectedCase.beneficiary.village,
                        selectedCase.beneficiary.weeks != null ? `${selectedCase.beneficiary.weeks} weeks` : null,
                        selectedCase.beneficiary.age != null ? `Age ${selectedCase.beneficiary.age}` : null,
                        `Reported by ${selectedCase.ashaName}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="mt-1 text-xs font-medium text-asha-muted">
                      Visited {formatIndiaDateTime(selectedCase.visitedAt)}
                      {selectedCase.call.doctorJoinedAt
                        ? ` · Doctor joined call at ${formatIndiaTime(selectedCase.call.doctorJoinedAt)}`
                        : ''}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isDoctorSession ? (
                      <button
                        type="button"
                        onClick={() => {
                          void calling.startCall({
                            visitId: selectedCase.id,
                            patientName: selectedCase.beneficiary.name,
                            patientVillage: selectedCase.beneficiary.village,
                            riskLevel: selectedCase.risk.level,
                          });
                        }}
                        disabled={isRingingSelectedCase}
                        className="inline-flex items-center gap-2 rounded-full bg-asha-teal px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-asha-teal-dark disabled:opacity-60"
                      >
                        <Phone className="h-4 w-4" aria-hidden />
                        {isRingingSelectedCase ? 'Ringing…' : 'Call ASHA'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Sign in as a PHC Doctor to call the ASHA worker"
                        className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-asha-line bg-asha-sand px-5 py-2.5 text-sm font-bold text-asha-muted"
                      >
                        <Phone className="h-4 w-4" aria-hidden />
                        Call ASHA
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* Clinical Risk & Vitals Card */}
              <RiskResult visit={toSnapshotVisit(selectedCase)} events={events} s={s} />

              {/* Alert & Follow-up Cards */}
              {(selectedCase.alert || selectedCase.alertHeld || selectedCase.followUp) && (
                <div
                  className={cn(
                    'grid gap-4',
                    (selectedCase.alert || selectedCase.alertHeld) && selectedCase.followUp
                      ? 'md:grid-cols-2'
                      : 'grid-cols-1',
                  )}
                >
                  {(selectedCase.alert || selectedCase.alertHeld) && (
                    <section className="rounded-3xl border border-asha-line bg-white p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-base font-extrabold text-asha-ink">
                          <Bell className="h-4 w-4 text-asha-teal" aria-hidden />
                          PHC Alert
                        </h3>
                        <AlertBadge visitCase={selectedCase} />
                      </div>

                      {selectedCase.alert ? (
                        <div className="mt-3 space-y-2">
                          <p className="rounded-2xl bg-asha-sand/70 p-3.5 text-sm leading-relaxed text-asha-ink">
                            {selectedCase.alert.message}
                          </p>
                          <p className="text-xs text-asha-muted">
                            {[
                              selectedCase.alert.channel
                                ? `Channel: ${formatAlertChannel(selectedCase.alert.channel)}`
                                : null,
                              selectedCase.alert.doctor ? `To: ${selectedCase.alert.doctor}` : null,
                              selectedCase.alert.sentAt
                                ? `Sent ${formatIndiaDateTime(selectedCase.alert.sentAt)}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {selectedCase.alert.error && (
                            <p className="text-xs font-semibold text-asha-red">
                              Delivery error: {selectedCase.alert.error}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-asha-muted">
                          Automatic alert was held by the ASHA worker during the visit.
                        </p>
                      )}
                    </section>
                  )}

                  {selectedCase.followUp && (
                    <section className="rounded-3xl border border-asha-line bg-white p-5">
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-asha-ink">
                        <CalendarClock className="h-4 w-4 text-asha-teal" aria-hidden />
                        Scheduled Follow-up
                      </h3>
                      <p className="mt-3 text-lg font-extrabold text-asha-teal">
                        {formatDueDate(selectedCase.followUp.dueDate, uiLang)}
                      </p>
                      <p className="mt-1 text-sm text-asha-muted">
                        {selectedCase.followUp.reason ?? 'Routine antenatal follow-up check'}
                      </p>
                    </section>
                  )}
                </div>
              )}

              {/* Visit History Card */}
              <VisitHistoryCard
                visits={selectedCase.recentVisits}
                activeVisitId={selectedCase.id}
                title="Visit History"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PatientsTab({
  patients,
  uiLang,
}: {
  patients: PatientSummary[];
  uiLang: UiLang;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PatientFilter>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const highRiskCount = useMemo(
    () => patients.filter((p) => p.latestVisit !== null && isHighRisk(p.latestVisit.riskLevel)).length,
    [patients],
  );
  const pendingTodayCount = useMemo(
    () => patients.filter((p) => !p.visitedToday).length,
    [patients],
  );
  const visitedTodayCount = useMemo(
    () => patients.filter((p) => p.visitedToday).length,
    [patients],
  );

  const filteredPatients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return patients.filter((p) => {
      if (filter === 'high_risk' && !(p.latestVisit && isHighRisk(p.latestVisit.riskLevel))) return false;
      if (filter === 'pending_today' && p.visitedToday) return false;
      if (filter === 'visited_today' && !p.visitedToday) return false;
      if (normalized.length > 0) {
        const nameMatch = p.name.toLowerCase().includes(normalized);
        const villageMatch = (p.village ?? '').toLowerCase().includes(normalized);
        if (!nameMatch && !villageMatch) return false;
      }
      return true;
    });
  }, [patients, filter, query]);

  const selectedPatient = useMemo(() => {
    if (filteredPatients.length === 0) return null;
    if (selectedPatientId) {
      const match = filteredPatients.find((p) => p.id === selectedPatientId);
      if (match) return match;
    }
    return filteredPatients[0];
  }, [filteredPatients, selectedPatientId]);

  if (patients.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-asha-line bg-white/75 p-10 text-center">
        <p className="font-display text-xl font-extrabold text-asha-ink">No registered mothers yet</p>
        <p className="mt-2 text-sm text-asha-muted">
          Registered beneficiaries for this PHC will appear here once added.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-asha-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by mother name or village…"
            aria-label="Search patients by name or village"
            className="w-full rounded-full border border-asha-line bg-white py-2.5 pl-10 pr-4 text-sm text-asha-ink placeholder:text-asha-muted focus:border-asha-teal focus:outline-none focus:ring-4 focus:ring-asha-teal/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter patients">
          <FilterChip
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="All"
            count={patients.length}
          />
          <FilterChip
            active={filter === 'high_risk'}
            onClick={() => setFilter('high_risk')}
            label="High risk"
            count={highRiskCount}
            tone="red"
          />
          <FilterChip
            active={filter === 'pending_today'}
            onClick={() => setFilter('pending_today')}
            label="Pending today"
            count={pendingTodayCount}
          />
          <FilterChip
            active={filter === 'visited_today'}
            onClick={() => setFilter('visited_today')}
            label="Visited today"
            count={visitedTodayCount}
          />
        </div>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-asha-line bg-white/75 p-8 text-center">
          <p className="text-lg font-extrabold text-asha-ink">No matching patients</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
            className="mt-3 rounded-full border border-asha-line bg-white px-4 py-2 text-sm font-bold text-asha-teal hover:bg-asha-mint/40"
          >
            Clear search &amp; filters
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(20rem,24rem)_1fr]">
          {/* Left Patient List */}
          <section aria-label="Registered patients" className="space-y-2.5">
            {filteredPatients.map((patient) => {
              const isSelected = selectedPatient?.id === patient.id;
              return (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-teal/30',
                    isSelected
                      ? 'border-asha-teal bg-white shadow-sm ring-2 ring-asha-teal/15'
                      : 'border-asha-line bg-white/80 hover:border-asha-teal/40 hover:bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-asha-ink">{patient.name}</p>
                      <p className="truncate text-xs font-medium text-asha-muted">
                        {[
                          patient.village,
                          patient.gestationWeeks != null ? `${patient.gestationWeeks}w` : null,
                          patient.age != null ? `Age ${patient.age}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {patient.latestVisit ? (
                      <RiskPill level={patient.latestVisit.riskLevel} />
                    ) : (
                      <span className="rounded-full bg-asha-sand px-2.5 py-0.5 text-xs font-bold text-asha-muted">
                        NO VISITS
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 font-semibold',
                        patient.visitedToday
                          ? 'bg-asha-mint text-asha-teal'
                          : 'bg-asha-sand text-asha-muted',
                      )}
                    >
                      {patient.visitedToday ? 'Visited today' : 'Pending today'}
                    </span>

                    {patient.nextFollowUp && (
                      <span
                        className={cn(
                          'font-semibold',
                          patient.nextFollowUp.status === 'overdue'
                            ? 'text-asha-red'
                            : patient.nextFollowUp.status === 'today'
                              ? 'text-asha-orange'
                              : 'text-asha-muted',
                        )}
                      >
                        {patient.nextFollowUp.status === 'overdue'
                          ? 'Follow-up overdue'
                          : patient.nextFollowUp.status === 'today'
                            ? 'Due today'
                            : `Next: ${formatDueDate(patient.nextFollowUp.dueDate, uiLang)}`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </section>

          {/* Right Patient Detail */}
          {selectedPatient && (
            <div className="min-w-0 space-y-5">
              {/* Profile Header */}
              <section className="rounded-3xl border border-asha-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-display text-2xl font-extrabold text-asha-ink">
                        {selectedPatient.name}
                      </h2>
                      {selectedPatient.latestVisit && (
                        <RiskPill level={selectedPatient.latestVisit.riskLevel} />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-asha-muted">
                      {[
                        selectedPatient.village,
                        selectedPatient.age != null ? `Age ${selectedPatient.age}` : null,
                        selectedPatient.parity != null
                          ? selectedPatient.parity === 0
                            ? 'First pregnancy'
                            : `Parity ${selectedPatient.parity}`
                          : null,
                        selectedPatient.gestationWeeks != null
                          ? `${selectedPatient.gestationWeeks} weeks gestation`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-bold',
                      selectedPatient.visitedToday
                        ? 'bg-asha-mint text-asha-teal'
                        : 'bg-asha-sand text-asha-muted',
                    )}
                  >
                    {selectedPatient.visitedToday ? 'Visited today' : 'Not yet visited today'}
                  </span>
                </div>

                {/* Latest Vitals */}
                <div className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-asha-muted">
                    Latest Vitals
                  </h3>
                  {selectedPatient.latestVisit ? (
                    <div className="mt-2 space-y-3">
                      <div className="grid grid-cols-3 gap-2.5">
                        <div
                          className={cn(
                            'rounded-2xl px-3.5 py-3',
                            isHighRisk(selectedPatient.latestVisit.riskLevel) &&
                              selectedPatient.latestVisit.bpSys != null
                              ? 'bg-asha-red-soft'
                              : 'bg-asha-sand',
                          )}
                        >
                          <p className="text-xs font-bold text-asha-muted">BP</p>
                          <p
                            className={cn(
                              'text-lg font-extrabold',
                              isHighRisk(selectedPatient.latestVisit.riskLevel) &&
                                selectedPatient.latestVisit.bpSys != null
                                ? 'text-asha-red'
                                : 'text-asha-ink',
                            )}
                          >
                            {formatBp(
                              selectedPatient.latestVisit.bpSys,
                              selectedPatient.latestVisit.bpDia,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-asha-sand px-3.5 py-3">
                          <p className="text-xs font-bold text-asha-muted">Hb</p>
                          <p className="text-lg font-extrabold text-asha-ink">
                            {formatHb(selectedPatient.latestVisit.hb)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-asha-sand px-3.5 py-3">
                          <p className="text-xs font-bold text-asha-muted">Recorded</p>
                          <p className="text-sm font-extrabold text-asha-ink">
                            {formatIndiaDate(selectedPatient.latestVisit.visitedAt)}
                          </p>
                        </div>
                      </div>

                      {selectedPatient.latestVisit.symptoms.length > 0 && (
                        <p className="text-sm text-asha-muted">
                          <span className="font-semibold text-asha-ink">Symptoms: </span>
                          {selectedPatient.latestVisit.symptoms
                            .map((sym) => sym.replace(/_/g, ' '))
                            .join(', ')}
                        </p>
                      )}

                      {selectedPatient.latestVisit.riskReasons.length > 0 && (
                        <ul className="space-y-1.5 rounded-2xl border border-asha-line bg-asha-cream/60 p-3.5 text-sm">
                          {selectedPatient.latestVisit.riskReasons.map((reason) => (
                            <li key={reason.code} className="font-medium text-asha-ink">
                              • {reason.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-2xl bg-asha-sand/60 px-4 py-3 text-sm text-asha-muted">
                      No ANC visits recorded yet for this mother.
                    </p>
                  )}
                </div>
              </section>

              {/* Next Follow-up */}
              {selectedPatient.nextFollowUp && (
                <section
                  className={cn(
                    'rounded-3xl border p-5',
                    selectedPatient.nextFollowUp.status === 'overdue'
                      ? 'border-asha-red/30 bg-asha-red-soft'
                      : 'border-asha-line bg-white',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-base font-extrabold text-asha-ink">
                      <CalendarClock className="h-4 w-4 text-asha-teal" aria-hidden />
                      Next Follow-up
                    </h3>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase',
                        selectedPatient.nextFollowUp.status === 'overdue'
                          ? 'bg-asha-red text-white'
                          : selectedPatient.nextFollowUp.status === 'today'
                            ? 'bg-asha-orange text-white'
                            : 'bg-asha-mint text-asha-teal',
                      )}
                    >
                      {selectedPatient.nextFollowUp.status}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-extrabold text-asha-ink">
                    {formatDueDate(selectedPatient.nextFollowUp.dueDate, uiLang)}
                  </p>
                  {selectedPatient.nextFollowUp.reason && (
                    <p className="mt-1 text-sm text-asha-muted">
                      {selectedPatient.nextFollowUp.reason}
                    </p>
                  )}
                </section>
              )}

              {/* Past Visit History */}
              <VisitHistoryCard visits={selectedPatient.recentVisits} title="Past Visits" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ events }: { events: SnapshotEvent[] }) {
  const reversed = useMemo(() => [...events].reverse(), [events]);

  return (
    <section
      className="rounded-3xl border border-asha-line bg-white p-5 sm:p-6"
      aria-label="Agent timeline"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-extrabold text-asha-ink">Agent timeline</h2>
          <p className="text-sm text-asha-muted">
            Real-time tool invocations and clinical workflow events from voice sessions.
          </p>
        </div>
        <span className="rounded-full bg-asha-sand px-3 py-1 text-xs font-bold text-asha-muted">
          {events.length} events
        </span>
      </div>

      {reversed.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-asha-line bg-asha-cream/50 p-6 text-center text-sm text-asha-muted">
          Tool calls appear here as the voice assistant records visits, evaluates ANC rules, and sends PHC alerts.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-asha-line">
          {reversed.map((event) => (
            <li key={event.id} className="flex items-center gap-3 py-3">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  event.ok ? 'bg-asha-mint text-asha-teal' : 'bg-asha-red-soft text-asha-red',
                )}
              >
                {event.ok ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <TriangleAlert className="h-4 w-4" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-sm font-semibold text-asha-ink">
                  {event.name}
                </span>
                {event.note && <span className="block text-sm text-asha-muted">{event.note}</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                {event.ms != null && (
                  <span className="whitespace-nowrap font-mono text-xs font-semibold text-asha-ink">
                    {event.ms} ms
                  </span>
                )}
                <span className="whitespace-nowrap text-xs text-asha-muted">
                  {formatIndiaTime(event.at)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VisitHistoryCard({
  visits,
  activeVisitId,
  title,
}: {
  visits: PatientVisitSummary[];
  activeVisitId?: string;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-asha-line bg-white p-5">
      <h3 className="flex items-center gap-2 text-base font-extrabold text-asha-ink">
        <Clock className="h-4 w-4 text-asha-teal" aria-hidden />
        {title}
      </h3>

      {visits.length === 0 ? (
        <p className="mt-3 text-sm text-asha-muted">No recorded visits yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-asha-line">
          {visits.map((visit) => {
            const isCurrent = activeVisitId === visit.id;
            return (
              <li
                key={visit.id}
                className={cn(
                  'flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between',
                  isCurrent && 'rounded-xl bg-asha-mint/30 px-3',
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-asha-ink">
                      {formatIndiaDateTime(visit.visitedAt)}
                    </span>
                    <RiskPill level={visit.riskLevel} />
                    {isCurrent && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-asha-teal">
                        Selected
                      </span>
                    )}
                  </div>
                  {visit.symptoms.length > 0 && (
                    <p className="mt-1 text-xs text-asha-muted">
                      {visit.symptoms.map((sym) => sym.replace(/_/g, ' ')).join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs font-semibold">
                  <span className="rounded-lg bg-asha-sand px-2.5 py-1 text-asha-ink">
                    BP {formatBp(visit.bpSys, visit.bpDia)}
                  </span>
                  <span className="rounded-lg bg-asha-sand px-2.5 py-1 text-asha-ink">
                    Hb {formatHb(visit.hb)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RiskPill({ level }: { level: RiskLevel }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-wide',
        RISK_BADGE_STYLE[level],
      )}
    >
      {RISK_LABEL[level]}
    </span>
  );
}

function AlertBadge({ visitCase }: { visitCase: DoctorVisitCase }) {
  if (visitCase.alert?.status === 'sent') {
    const channelLabel = formatAlertChannel(visitCase.alert.channel);
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-asha-mint px-2.5 py-0.5 text-xs font-bold text-asha-teal">
        <Check className="h-3 w-3" aria-hidden />
        Sent via {channelLabel}
      </span>
    );
  }
  if (visitCase.alert?.status === 'draft') {
    return (
      <span className="inline-flex items-center rounded-full bg-asha-amber/20 px-2.5 py-0.5 text-xs font-bold text-[#8A5A00]">
        Draft
      </span>
    );
  }
  if (visitCase.alert?.status === 'failed') {
    return (
      <span className="inline-flex items-center rounded-full bg-asha-red-soft px-2.5 py-0.5 text-xs font-bold text-asha-red">
        Failed
      </span>
    );
  }
  if (visitCase.alertHeld) {
    return (
      <span className="inline-flex items-center rounded-full bg-asha-sand px-2.5 py-0.5 text-xs font-bold text-asha-muted">
        Held
      </span>
    );
  }
  return <span className="text-xs font-medium text-asha-muted">No alert</span>;
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: 'red';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-teal/30',
        active
          ? tone === 'red'
            ? 'border-asha-red bg-asha-red text-white'
            : 'border-asha-teal bg-asha-teal text-white'
          : 'border-asha-line bg-white text-asha-ink hover:border-asha-teal/40',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'rounded-full px-1.5 py-0.2 text-xs font-extrabold',
          active
            ? 'bg-white/20 text-white'
            : tone === 'red' && count > 0
              ? 'bg-asha-red-soft text-asha-red'
              : 'bg-asha-sand text-asha-muted',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'red' }) {
  const isHot = tone === 'red' && value > 0;
  return (
    <div
      className={cn(
        'rounded-3xl border px-5 py-4',
        isHot ? 'border-asha-red/30 bg-asha-red-soft' : 'border-asha-line bg-white',
      )}
    >
      <p className={cn('text-sm font-semibold', isHot ? 'text-asha-red' : 'text-asha-muted')}>
        {label}
      </p>
      <p className={cn('mt-1 font-display text-4xl font-extrabold', isHot && 'text-asha-red')}>
        {value}
      </p>
    </div>
  );
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-asha-line bg-white p-8 text-center">
      <p className="font-display text-xl font-extrabold text-asha-ink">{title}</p>
      <p className="mt-2 text-asha-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
