'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Send,
} from 'lucide-react';
import type { CallContextSummary, OutgoingCallStatus, UseWebCallingResult } from '@/lib/call/signaling-types';
import type { RiskLevel } from '@/lib/snapshot-types';

export interface WebCallOverlayProps {
  calling: UseWebCallingResult;
}

const RISK_STYLES: Record<RiskLevel, { label: string; className: string }> = {
  urgent: {
    label: 'Urgent',
    className: 'bg-asha-red text-white',
  },
  high: {
    label: 'High risk',
    className: 'bg-asha-red-soft text-asha-red',
  },
  watch: {
    label: 'Watch',
    className: 'bg-asha-amber text-asha-ink',
  },
  normal: {
    label: 'Normal',
    className: 'bg-asha-mint text-asha-teal-dark',
  },
};

function CallSummaryCard({ summary }: { summary: CallContextSummary }) {
  const showRisk = summary.riskLevel === 'urgent' || summary.riskLevel === 'high' || summary.riskLevel === 'watch';
  const riskMeta = showRisk && summary.riskLevel ? RISK_STYLES[summary.riskLevel] : null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-asha-line bg-asha-cream px-4 py-3 text-left">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-asha-ink">{summary.mother}</p>
        {summary.village && <p className="truncate text-xs text-asha-muted">{summary.village}</p>}
      </div>
      {riskMeta && (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${riskMeta.className}`}>
          {riskMeta.label}
        </span>
      )}
    </div>
  );
}

function OutgoingStatusBadge({ status }: { status: OutgoingCallStatus }) {
  if (status === 'ringing') {
    return (
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-asha-orange/25"
        />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-asha-orange text-white shadow-md">
          <PhoneOutgoing className="h-7 w-7" />
        </span>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-asha-mint text-asha-teal">
        <CheckCircle2 className="h-8 w-8" />
      </div>
    );
  }

  if (status === 'no_answer') {
    return (
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-asha-amber text-asha-ink">
        <PhoneMissed className="h-7 w-7" />
      </div>
    );
  }

  if (status === 'declined') {
    return (
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-asha-red-soft text-asha-red">
        <PhoneOff className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-asha-red-soft text-asha-red">
      <AlertCircle className="h-7 w-7" />
    </div>
  );
}

function getOutgoingHeadline(status: OutgoingCallStatus, toName: string): string {
  switch (status) {
    case 'ringing':
      return `Calling ${toName}…`;
    case 'accepted':
      return `${toName} accepted — opening call…`;
    case 'declined':
      return `${toName} couldn't answer right now`;
    case 'no_answer':
      return `No answer from ${toName}`;
    case 'error':
      return 'Could not start call';
  }
}

export function WebCallOverlay({ calling }: WebCallOverlayProps) {
  const { incomingCall, outgoingCall } = calling;
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  if (!incomingCall && !outgoingCall) return null;

  if (incomingCall) {
    const roleLabel = incomingCall.fromRole === 'asha' ? 'ASHA Worker' : 'PHC Doctor';

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Incoming voice call from ${incomingCall.fromName}`}
        className="fixed inset-0 z-50 flex items-center justify-center bg-asha-ink/50 p-4 backdrop-blur-sm"
      >
        <div className="w-full max-w-md rounded-3xl border border-asha-line bg-white p-6 text-center shadow-2xl">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-asha-teal/25"
            />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-asha-teal text-white shadow-md">
              <PhoneIncoming className="h-7 w-7" />
            </span>
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-asha-teal">
            Incoming voice call
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-asha-ink">
            {incomingCall.fromName}
          </h2>
          <div className="mt-2 flex justify-center">
            <span className="rounded-full border border-asha-line bg-asha-cream px-3 py-0.5 text-xs font-medium text-asha-muted">
              {roleLabel}
            </span>
          </div>

          {incomingCall.summary && <CallSummaryCard summary={incomingCall.summary} />}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void calling.acceptIncomingCall()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-asha-teal px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-asha-teal-dark focus:outline-none focus:ring-2 focus:ring-asha-teal focus:ring-offset-2"
            >
              <Phone className="h-4 w-4" />
              Accept &amp; Join
            </button>
            <button
              type="button"
              onClick={() => void calling.declineIncomingCall()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-asha-red-soft px-5 py-3.5 text-sm font-semibold text-asha-red transition-colors hover:bg-asha-red hover:text-white focus:outline-none focus:ring-2 focus:ring-asha-red focus:ring-offset-2"
            >
              <PhoneOff className="h-4 w-4" />
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!outgoingCall) return null;

  const headline = getOutgoingHeadline(outgoingCall.status, outgoingCall.toName);
  const canSendTelegram =
    (outgoingCall.status === 'declined' || outgoingCall.status === 'no_answer') &&
    calling.telegramConfigured &&
    !outgoingCall.telegramSent;

  const handleTelegramFallback = async () => {
    setIsSendingTelegram(true);
    try {
      await calling.sendTelegramFallback();
    } finally {
      setIsSendingTelegram(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      className="fixed inset-0 z-50 flex items-center justify-center bg-asha-ink/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-3xl border border-asha-line bg-white p-6 text-center shadow-2xl">
        <OutgoingStatusBadge status={outgoingCall.status} />

        <h2 className="mt-4 font-display text-xl font-bold text-asha-ink">{headline}</h2>

        {outgoingCall.status === 'error' && outgoingCall.errorMessage && (
          <p className="mt-1.5 text-sm text-asha-red">{outgoingCall.errorMessage}</p>
        )}

        {outgoingCall.status === 'ringing' && (
          <p className="mt-1 text-sm text-asha-muted">
            Waiting for {outgoingCall.toName} to pick up…
          </p>
        )}

        <CallSummaryCard summary={outgoingCall.summary} />

        {outgoingCall.telegramSent && (
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-asha-mint px-3 py-1 text-xs font-semibold text-asha-teal-dark">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Telegram call link sent
            </span>
          </div>
        )}

        {outgoingCall.telegramError && (
          <p className="mt-2 text-xs text-asha-red">{outgoingCall.telegramError}</p>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          {outgoingCall.status === 'ringing' && (
            <>
              {outgoingCall.selfUrl && (
                <a
                  href={outgoingCall.selfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-asha-teal px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-asha-teal-dark"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open call room now
                </a>
              )}
              <button
                type="button"
                onClick={() => void calling.cancelOutgoingCall()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-asha-red-soft px-5 py-3 text-sm font-semibold text-asha-red transition-colors hover:bg-asha-red hover:text-white"
              >
                <PhoneOff className="h-4 w-4" />
                Cancel call
              </button>
            </>
          )}

          {(outgoingCall.status === 'declined' || outgoingCall.status === 'no_answer') && (
            <>
              {canSendTelegram && (
                <button
                  type="button"
                  disabled={isSendingTelegram}
                  onClick={() => void handleTelegramFallback()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-asha-teal px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-asha-teal-dark disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {isSendingTelegram ? 'Sending Telegram link…' : 'Send Telegram call link'}
                </button>
              )}
              {outgoingCall.selfUrl && (
                <a
                  href={outgoingCall.selfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-asha-line bg-asha-cream px-5 py-3 text-sm font-semibold text-asha-ink transition-colors hover:bg-asha-sand"
                >
                  <ExternalLink className="h-4 w-4" />
                  Join room anyway
                </a>
              )}
              <button
                type="button"
                onClick={calling.dismissOutgoingCall}
                className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-medium text-asha-muted transition-colors hover:bg-asha-cream hover:text-asha-ink"
              >
                Close
              </button>
            </>
          )}

          {(outgoingCall.status === 'accepted' || outgoingCall.status === 'error') && (
            <>
              {outgoingCall.status === 'accepted' && outgoingCall.selfUrl && (
                <a
                  href={outgoingCall.selfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-asha-teal px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-asha-teal-dark"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open call room
                </a>
              )}
              <button
                type="button"
                onClick={calling.dismissOutgoingCall}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-asha-line bg-asha-cream px-5 py-3 text-sm font-semibold text-asha-ink transition-colors hover:bg-asha-sand"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
