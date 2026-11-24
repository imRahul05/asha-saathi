import type { RiskLevel } from '@/lib/snapshot-types';

export type CallSignalType = 'CALL_INVITE' | 'CALL_ACCEPTED' | 'CALL_DECLINED' | 'CALL_CANCELLED' | 'CALL_ENDED';

export interface CallContextSummary {
  mother: string;
  village: string | null;
  riskLevel: RiskLevel | null;
  visitId: string | null;
}

export interface CallSignalMessage {
  type: CallSignalType;
  callId: string;
  fromRole: 'asha' | 'doctor';
  fromName: string;
  channel: string;
  /** Signed /call/<token> URL for the callee to join the Agora RTC voice room */
  calleeUrl?: string;
  summary?: CallContextSummary;
  sentAt: string;
}

export interface RtmTokenResponse {
  appId: string;
  token: string;
  userId: string;
  peerId: string;
  channel: string;
  role: 'asha' | 'doctor';
  selfName: string;
  peerName: string;
  phcName: string;
  telegramConfigured: boolean;
}

export interface RingCallRequest {
  visitId?: string;
  patientName?: string;
  patientVillage?: string | null;
  riskLevel?: RiskLevel | null;
  notifyTelegram?: boolean;
  fallbackPeerUrl?: string;
}

export interface RingCallResponse {
  callId: string;
  channel: string;
  selfUrl: string;
  peerUrl: string;
  selfName: string;
  peerName: string;
  telegramSent: boolean;
  telegramError: string | null;
  summary: CallContextSummary;
}

export interface IncomingWebCall {
  callId: string;
  fromRole: 'asha' | 'doctor';
  fromName: string;
  channel: string;
  callUrl: string;
  summary: CallContextSummary | null;
}

export type OutgoingCallStatus = 'ringing' | 'accepted' | 'declined' | 'no_answer' | 'error';

export interface OutgoingWebCall {
  callId: string;
  toName: string;
  channel: string;
  selfUrl: string;
  peerUrl: string;
  status: OutgoingCallStatus;
  telegramSent: boolean;
  telegramError: string | null;
  summary: CallContextSummary;
  errorMessage: string | null;
}

export interface StartWebCallOptions {
  visitId?: string;
  patientName?: string;
  patientVillage?: string | null;
  riskLevel?: RiskLevel | null;
}

export interface UseWebCallingResult {
  isRtmConnected: boolean;
  isPeerOnline: boolean;
  peerName: string | null;
  telegramConfigured: boolean;
  incomingCall: IncomingWebCall | null;
  outgoingCall: OutgoingWebCall | null;
  startCall: (opts?: StartWebCallOptions) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  cancelOutgoingCall: () => Promise<void>;
  dismissOutgoingCall: () => void;
  sendTelegramFallback: () => Promise<void>;
}
