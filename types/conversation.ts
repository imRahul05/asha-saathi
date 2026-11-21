import type { RTMClient } from 'agora-rtm';

export interface AgoraTokenData {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}

export interface ClientStartRequest {
  requester_id: string;
  channel_name: string;
  /** Call language code, see lib/languages.ts */
  language?: string;
  /** Murf voice id chosen on the start screen (checked on the server against lib/voices.ts) */
  voice?: string;
}

export interface StopConversationRequest {
  agent_id: string;
}

export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  state: string;
}

export interface AgoraRenewalTokens {
  rtcToken: string;
  rtmToken: string;
}

export interface ConversationComponentProps {
  agoraData: AgoraTokenData;
  rtmClient: RTMClient;
  onTokenWillExpire: (uid: string) => Promise<AgoraRenewalTokens>;
  onEndConversation: () => void;
  /** End this call and start a new one with the same language and voice. `auto` is true for the automatic retry. */
  onRestart?: (auto?: boolean) => Promise<void> | void;
  /** Whether one more automatic retry is still allowed for this call */
  canAutoRetry?: () => boolean;
  /** The language this call was started in */
  callLanguage?: string;
}
