'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RTMClient, RTMEvents } from 'agora-rtm';
import type {
  CallContextSummary,
  CallSignalMessage,
  CallSignalType,
  IncomingWebCall,
  OutgoingWebCall,
  RingCallRequest,
  RingCallResponse,
  RtmTokenResponse,
  StartWebCallOptions,
  UseWebCallingResult,
} from '@/lib/call/signaling-types';
import type { RiskLevel } from '@/lib/snapshot-types';

const RING_TIMEOUT_MS = 35_000;

const VALID_SIGNAL_TYPES: ReadonlySet<CallSignalType> = new Set<CallSignalType>([
  'CALL_INVITE',
  'CALL_ACCEPTED',
  'CALL_DECLINED',
  'CALL_CANCELLED',
  'CALL_ENDED',
]);

const VALID_RISK_LEVELS: ReadonlySet<RiskLevel> = new Set<RiskLevel>([
  'normal',
  'watch',
  'high',
  'urgent',
]);

interface AudioContextWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

interface RawSummaryPayload {
  mother?: string;
  village?: string | null;
  riskLevel?: string | null;
  visitId?: string | null;
}

interface RawSignalPayload {
  type?: string;
  callId?: string;
  fromRole?: string;
  fromName?: string;
  channel?: string;
  calleeUrl?: string;
  summary?: RawSummaryPayload | null;
  sentAt?: string;
}

interface ErrorResponseBody {
  error?: string;
  message?: string;
}

function isCallSignalType(value: string): value is CallSignalType {
  return VALID_SIGNAL_TYPES.has(value as CallSignalType);
}

function isRiskLevel(value: string): value is RiskLevel {
  return VALID_RISK_LEVELS.has(value as RiskLevel);
}

function parseSummary(raw: RawSummaryPayload | null | undefined): CallContextSummary | undefined {
  if (!raw || typeof raw !== 'object' || typeof raw.mother !== 'string' || !raw.mother) {
    return undefined;
  }
  const village = typeof raw.village === 'string' ? raw.village : null;
  const riskLevel = typeof raw.riskLevel === 'string' && isRiskLevel(raw.riskLevel) ? raw.riskLevel : null;
  const visitId = typeof raw.visitId === 'string' ? raw.visitId : null;
  return {
    mother: raw.mother,
    village,
    riskLevel,
    visitId,
  };
}

function decodeRtmMessage(raw: string | Uint8Array): string {
  if (typeof raw === 'string') return raw;
  try {
    return new TextDecoder().decode(raw);
  } catch {
    return '';
  }
}

function parseCallSignal(raw: string | Uint8Array): CallSignalMessage | null {
  const text = decodeRtmMessage(raw);
  if (!text) return null;

  let parsed: RawSignalPayload | null = null;
  try {
    parsed = JSON.parse(text) as RawSignalPayload | null;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  if (typeof parsed.type !== 'string' || !isCallSignalType(parsed.type)) return null;
  if (typeof parsed.callId !== 'string' || !parsed.callId) return null;
  if (parsed.fromRole !== 'asha' && parsed.fromRole !== 'doctor') return null;
  if (typeof parsed.fromName !== 'string' || !parsed.fromName) return null;
  if (typeof parsed.channel !== 'string' || !parsed.channel) return null;
  if (typeof parsed.sentAt !== 'string' || !parsed.sentAt) return null;

  const summary = parseSummary(parsed.summary);

  return {
    type: parsed.type,
    callId: parsed.callId,
    fromRole: parsed.fromRole,
    fromName: parsed.fromName,
    channel: parsed.channel,
    ...(typeof parsed.calleeUrl === 'string' && parsed.calleeUrl ? { calleeUrl: parsed.calleeUrl } : {}),
    ...(summary ? { summary } : {}),
    sentAt: parsed.sentAt,
  };
}

function startGentleRingtone(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  try {
    const audioWindow = window as AudioContextWindow;
    const AudioCtx = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioCtx) return () => undefined;

    const ctx = new AudioCtx();
    let stopped = false;

    const playChime = () => {
      if (stopped) return;
      try {
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => undefined);
        }
        const now = ctx.currentTime;
        const notes = [523.25, 659.25]; // C5 -> E5 soft two-tone chime
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.24);
          gain.gain.setValueAtTime(0.0001, now + idx * 0.24);
          gain.gain.exponentialRampToValueAtTime(0.06, now + idx * 0.24 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.24 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.24);
          osc.stop(now + idx * 0.24 + 0.24);
        });
      } catch {
        // Ignore audio scheduling errors caused by autoplay restrictions
      }
    };

    playChime();
    const intervalId = window.setInterval(playChime, 2600);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      ctx.close().catch(() => undefined);
    };
  } catch {
    return () => undefined;
  }
}

function openCallUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.href = url;
  }
}

export function useWebCalling(opts?: { enabled?: boolean }): UseWebCallingResult {
  const enabled = opts?.enabled !== false;

  const [isRtmConnected, setIsRtmConnectedState] = useState(false);
  const [isPeerOnline, setIsPeerOnlineState] = useState(false);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [incomingCall, setIncomingCallState] = useState<IncomingWebCall | null>(null);
  const [outgoingCall, setOutgoingCallState] = useState<OutgoingWebCall | null>(null);

  const rtmRef = useRef<RTMClient | null>(null);
  const infoRef = useRef<RtmTokenResponse | null>(null);
  const isRtmConnectedRef = useRef(false);
  const isPeerOnlineRef = useRef(false);
  const incomingCallRef = useRef<IncomingWebCall | null>(null);
  const outgoingCallRef = useRef<OutgoingWebCall | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringtoneStopRef = useRef<(() => void) | null>(null);

  const setRtmConnected = useCallback((connected: boolean) => {
    isRtmConnectedRef.current = connected;
    setIsRtmConnectedState(connected);
  }, []);

  const setPeerOnline = useCallback((online: boolean) => {
    isPeerOnlineRef.current = online;
    setIsPeerOnlineState(online);
  }, []);

  const setIncomingCall = useCallback((next: IncomingWebCall | null) => {
    incomingCallRef.current = next;
    setIncomingCallState(next);
  }, []);

  const setOutgoingCall = useCallback((next: OutgoingWebCall | null) => {
    outgoingCallRef.current = next;
    setOutgoingCallState(next);
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }
  }, []);

  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current !== null) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  const publishSignal = useCallback(async (signal: CallSignalMessage): Promise<void> => {
    const rtm = rtmRef.current;
    const info = infoRef.current;
    if (!rtm || !info || !isRtmConnectedRef.current) return;
    try {
      await rtm.publish(info.channel, JSON.stringify(signal));
    } catch {
      // Non-fatal: peer may still join via Telegram or direct link
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let disposed = false;
    let client: RTMClient | null = null;

    void (async () => {
      try {
        const res = await fetch('/api/call/rtm-token', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok || disposed) {
          if (!disposed) setRtmConnected(false);
          return;
        }

        const info = (await res.json()) as RtmTokenResponse;
        if (disposed || !info.appId || !info.token || !info.userId || !info.channel) {
          if (!disposed) setRtmConnected(false);
          return;
        }

        infoRef.current = info;
        setPeerName(info.peerName);
        setTelegramConfigured(info.telegramConfigured);

        const { default: AgoraRTM } = await import('agora-rtm');
        if (disposed) return;

        const rtm: RTMClient = new AgoraRTM.RTM(info.appId, info.userId);
        client = rtm;

        const handleMessage = (event: RTMEvents.MessageEvent) => {
          if (disposed || event.publisher === info.userId) return;
          const msg = parseCallSignal(event.message);
          if (!msg) return;

          if (msg.type === 'CALL_INVITE') {
            if (!msg.calleeUrl) return;
            stopRingtone();
            setIncomingCall({
              callId: msg.callId,
              fromRole: msg.fromRole,
              fromName: msg.fromName,
              channel: msg.channel,
              callUrl: msg.calleeUrl,
              summary: msg.summary ?? null,
            });
            ringtoneStopRef.current = startGentleRingtone();
            return;
          }

          if (msg.type === 'CALL_CANCELLED') {
            if (incomingCallRef.current?.callId === msg.callId) {
              stopRingtone();
              setIncomingCall(null);
            }
            return;
          }

          if (msg.type === 'CALL_ACCEPTED') {
            const current = outgoingCallRef.current;
            if (current && current.callId === msg.callId) {
              clearRingTimeout();
              const acceptedCall: OutgoingWebCall = {
                ...current,
                status: 'accepted',
              };
              setOutgoingCall(acceptedCall);
              openCallUrl(current.selfUrl);
            }
            return;
          }

          if (msg.type === 'CALL_DECLINED') {
            const current = outgoingCallRef.current;
            if (current && current.callId === msg.callId) {
              clearRingTimeout();
              setOutgoingCall({
                ...current,
                status: 'declined',
              });
            }
          }
        };

        const handlePresence = (event: RTMEvents.PresenceEvent) => {
          if (disposed) return;

          if (event.eventType === 'SNAPSHOT') {
            const present = event.snapshot?.some((u) => u.userId === info.peerId) ?? false;
            setPeerOnline(present);
            return;
          }

          if (event.eventType === 'INTERVAL' && event.interval) {
            if (event.interval.join.users.includes(info.peerId)) {
              setPeerOnline(true);
            } else if (
              event.interval.leave.users.includes(info.peerId) ||
              event.interval.timeout.users.includes(info.peerId)
            ) {
              setPeerOnline(false);
            }
            return;
          }

          if (event.publisher === info.peerId) {
            if (event.eventType === 'REMOTE_JOIN') {
              setPeerOnline(true);
            } else if (event.eventType === 'REMOTE_LEAVE' || event.eventType === 'REMOTE_TIMEOUT') {
              setPeerOnline(false);
            }
          }
        };

        const handleStatus = (
          event: RTMEvents.RTMConnectionStatusChangeEvent | RTMEvents.StreamChannelConnectionStatusChangeEvent,
        ) => {
          if (disposed || 'channelName' in event) return;
          if (event.state === 'CONNECTED') {
            setRtmConnected(true);
          } else if (event.state === 'DISCONNECTED' || event.state === 'FAILED') {
            setRtmConnected(false);
          }
        };

        rtm.addEventListener('message', handleMessage);
        rtm.addEventListener('presence', handlePresence);
        rtm.addEventListener('status', handleStatus);

        await rtm.login({ token: info.token });
        if (disposed) {
          rtm.logout().catch(() => undefined);
          return;
        }

        await rtm.subscribe(info.channel, {
          withMessage: true,
          withPresence: true,
        });
        if (disposed) {
          rtm.logout().catch(() => undefined);
          return;
        }

        rtmRef.current = rtm;
        setRtmConnected(true);

        try {
          const who = await rtm.presence.whoNow(info.channel, 'MESSAGE');
          if (!disposed) {
            const peerPresent = who.occupants.some((occupant) => occupant.userId === info.peerId);
            setPeerOnline(peerPresent);
          }
        } catch {
          // Presence snapshot may fail transiently; rely on presence events
        }
      } catch (err) {
        if (disposed) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setRtmConnected(false);
      }
    })();

    return () => {
      disposed = true;
      controller.abort();
      clearRingTimeout();
      stopRingtone();
      rtmRef.current = null;
      isRtmConnectedRef.current = false;
      isPeerOnlineRef.current = false;
      if (client) {
        client.logout().catch(() => undefined);
      }
    };
  }, [clearRingTimeout, enabled, setIncomingCall, setOutgoingCall, setPeerOnline, setRtmConnected, stopRingtone]);

  const startCall = useCallback(
    async (callOpts?: StartWebCallOptions): Promise<void> => {
      clearRingTimeout();
      const info = infoRef.current;
      const shouldNotifyTelegram = !isPeerOnlineRef.current && info?.role === 'asha';

      const payload: RingCallRequest = {
        ...(callOpts?.visitId ? { visitId: callOpts.visitId } : {}),
        ...(callOpts?.patientName ? { patientName: callOpts.patientName } : {}),
        ...(callOpts?.patientVillage !== undefined ? { patientVillage: callOpts.patientVillage } : {}),
        ...(callOpts?.riskLevel !== undefined ? { riskLevel: callOpts.riskLevel } : {}),
        notifyTelegram: shouldNotifyTelegram,
      };

      const fallbackSummary: CallContextSummary = {
        mother: callOpts?.patientName ?? 'Direct consultation',
        village: callOpts?.patientVillage ?? null,
        riskLevel: callOpts?.riskLevel ?? null,
        visitId: callOpts?.visitId ?? null,
      };

      try {
        const res = await fetch('/api/call/ring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as ErrorResponseBody;
          setOutgoingCall({
            callId: '',
            toName: info?.peerName ?? 'PHC Doctor',
            channel: '',
            selfUrl: '',
            peerUrl: '',
            status: 'error',
            telegramSent: false,
            telegramError: null,
            summary: fallbackSummary,
            errorMessage: errBody.message ?? errBody.error ?? `Request failed (HTTP ${res.status})`,
          });
          return;
        }

        const data = (await res.json()) as RingCallResponse;

        setOutgoingCall({
          callId: data.callId,
          toName: data.peerName,
          channel: data.channel,
          selfUrl: data.selfUrl,
          peerUrl: data.peerUrl,
          status: 'ringing',
          telegramSent: data.telegramSent,
          telegramError: data.telegramError,
          summary: data.summary,
          errorMessage: null,
        });

        if (info && isRtmConnectedRef.current) {
          const invite: CallSignalMessage = {
            type: 'CALL_INVITE',
            callId: data.callId,
            fromRole: info.role,
            fromName: data.selfName,
            channel: data.channel,
            calleeUrl: data.peerUrl,
            summary: data.summary,
            sentAt: new Date().toISOString(),
          };
          await publishSignal(invite);
        }

        ringTimeoutRef.current = setTimeout(() => {
          ringTimeoutRef.current = null;
          const current = outgoingCallRef.current;
          if (current && current.callId === data.callId && current.status === 'ringing') {
            setOutgoingCall({
              ...current,
              status: 'no_answer',
            });
          }
        }, RING_TIMEOUT_MS);
      } catch (err) {
        setOutgoingCall({
          callId: '',
          toName: info?.peerName ?? 'PHC Doctor',
          channel: '',
          selfUrl: '',
          peerUrl: '',
          status: 'error',
          telegramSent: false,
          telegramError: null,
          summary: fallbackSummary,
          errorMessage: err instanceof Error ? err.message : 'Network error starting call',
        });
      }
    },
    [clearRingTimeout, publishSignal, setOutgoingCall],
  );

  const acceptIncomingCall = useCallback(async (): Promise<void> => {
    const current = incomingCallRef.current;
    if (!current) return;

    stopRingtone();
    const targetUrl = current.callUrl;
    setIncomingCall(null);

    const info = infoRef.current;
    if (info) {
      await publishSignal({
        type: 'CALL_ACCEPTED',
        callId: current.callId,
        fromRole: info.role,
        fromName: info.selfName,
        channel: current.channel,
        sentAt: new Date().toISOString(),
      });
    }

    openCallUrl(targetUrl);
  }, [publishSignal, setIncomingCall, stopRingtone]);

  const declineIncomingCall = useCallback(async (): Promise<void> => {
    const current = incomingCallRef.current;
    if (!current) return;

    stopRingtone();
    setIncomingCall(null);

    const info = infoRef.current;
    if (info) {
      await publishSignal({
        type: 'CALL_DECLINED',
        callId: current.callId,
        fromRole: info.role,
        fromName: info.selfName,
        channel: current.channel,
        sentAt: new Date().toISOString(),
      });
    }
  }, [publishSignal, setIncomingCall, stopRingtone]);

  const cancelOutgoingCall = useCallback(async (): Promise<void> => {
    const current = outgoingCallRef.current;
    clearRingTimeout();
    setOutgoingCall(null);

    const info = infoRef.current;
    if (current && current.callId && info) {
      await publishSignal({
        type: 'CALL_CANCELLED',
        callId: current.callId,
        fromRole: info.role,
        fromName: info.selfName,
        channel: current.channel,
        sentAt: new Date().toISOString(),
      });
    }
  }, [clearRingTimeout, publishSignal, setOutgoingCall]);

  const dismissOutgoingCall = useCallback((): void => {
    clearRingTimeout();
    setOutgoingCall(null);
  }, [clearRingTimeout, setOutgoingCall]);

  const sendTelegramFallback = useCallback(async (): Promise<void> => {
    const current = outgoingCallRef.current;
    if (!current || current.telegramSent || !current.peerUrl) return;

    const payload: RingCallRequest = {
      ...(current.summary.visitId ? { visitId: current.summary.visitId } : {}),
      patientName: current.summary.mother,
      patientVillage: current.summary.village,
      riskLevel: current.summary.riskLevel,
      notifyTelegram: true,
      fallbackPeerUrl: current.peerUrl,
    };

    try {
      const res = await fetch('/api/call/ring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const latest = outgoingCallRef.current;
        if (latest && latest.callId === current.callId) {
          setOutgoingCall({
            ...latest,
            telegramError: `Could not send Telegram link (HTTP ${res.status})`,
          });
        }
        return;
      }

      const data = (await res.json()) as RingCallResponse;
      const latest = outgoingCallRef.current;
      if (latest && latest.callId === current.callId) {
        setOutgoingCall({
          ...latest,
          telegramSent: data.telegramSent,
          telegramError: data.telegramError,
        });
      }
    } catch (err) {
      const latest = outgoingCallRef.current;
      if (latest && latest.callId === current.callId) {
        setOutgoingCall({
          ...latest,
          telegramError: err instanceof Error ? err.message : 'Failed to send Telegram link',
        });
      }
    }
  }, [setOutgoingCall]);

  return {
    isRtmConnected: enabled && isRtmConnected,
    isPeerOnline: enabled && isPeerOnline,
    peerName: enabled ? peerName : null,
    telegramConfigured: enabled && telegramConfigured,
    incomingCall: enabled ? incomingCall : null,
    outgoingCall: enabled ? outgoingCall : null,
    startCall,
    acceptIncomingCall,
    declineIncomingCall,
    cancelOutgoingCall,
    dismissOutgoingCall,
    sendTelegramFallback,
  };
}
