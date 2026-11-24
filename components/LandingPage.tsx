'use client';

import { useState, useRef, Suspense, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { RTMClient } from 'agora-rtm';
import type {
  AgoraTokenData,
  ClientStartRequest,
  AgentResponse,
  AgoraRenewalTokens,
} from '../types/conversation';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { StartScreen } from './asha/StartScreen';
import { AshaWorkspace } from './asha/AshaWorkspace';
import { DEFAULT_LANGUAGE, type LangCode } from '@/lib/languages';
import { useLanguage } from '@/components/i18n/LanguageProvider';
import { defaultVoice, resolveVoice } from '@/lib/voices';
import { startRtmBuffer, type RtmBuffer } from '@/lib/rtm-buffer';
import { useVoicePreview } from '@/hooks/use-voice-preview';
import { useAshaOverview } from '@/hooks/use-asha-overview';
import {
  SETUP_DONE_COOKIE,
  readPrefCookie,
  voiceCookieName,
  writePrefCookie,
} from '@/lib/client-prefs';

// Dynamically import the ConversationComponent with ssr disabled
const ConversationComponent = dynamic(() => import('./ConversationComponent'), {
  ssr: false,
});

// Dynamically import AgoraRTCProvider (browser-only).
// The AgoraVoiceAI toolkit is initialized inside ConversationComponent after
// the RTC join succeeds, so this wrapper only needs to provide the RTC client.
const AgoraProvider = dynamic(
  async () => {
    const { AgoraRTCProvider, default: AgoraRTC } =
      await import('agora-rtc-react');
    return {
      default: function AgoraProviders({
        children,
      }: {
        children: React.ReactNode;
      }) {
        // useRef persists across StrictMode's simulated unmount/remount, so only
        // one RTC client is ever created per session (useMemo creates two in StrictMode).
        const clientRef = useRef<ReturnType<
          typeof AgoraRTC.createClient
        > | null>(null);
        if (!clientRef.current) {
          clientRef.current = AgoraRTC.createClient({
            mode: 'rtc',
            codec: 'vp8',
          });
        }
        return (
          <AgoraRTCProvider client={clientRef.current}>
            {children}
          </AgoraRTCProvider>
        );
      },
    };
  },
  { ssr: false },
);

interface LandingPageProps {
  initialSetupDone?: boolean;
}

export default function LandingPage({ initialSetupDone = false }: LandingPageProps) {
  const [showConversation, setShowConversation] = useState(false);
  const {
    overview,
    isLoading: isOverviewLoading,
    error: overviewError,
    isOffline: isOverviewOffline,
    cachedAt: overviewCachedAt,
    refresh: refreshOverview,
  } = useAshaOverview();
  const [hasCompletedSetup, setHasCompletedSetup] = useState(initialSetupDone);

  const markSetupDone = useCallback(() => {
    writePrefCookie(SETUP_DONE_COOKIE, '1');
    setHasCompletedSetup(true);
  }, []);

  // Preload heavy modules on mount so they're already cached when the user
  // clicks "Try it Now" — eliminates the ~1.8s dynamic-import delay.
  useEffect(() => {
    import('agora-rtc-react').catch(() => {});
    import('agora-rtm').catch(() => {});
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agoraData, setAgoraData] = useState<AgoraTokenData | null>(null);
  const [rtmClient, setRtmClient] = useState<RTMClient | null>(null);
  // Every RTM message since login, so the caption reader can catch up on anything sent before it started listening.
  const rtmBufferRef = useRef<RtmBuffer | null>(null);
  // Real reason the agent could not start (HTTP status + body), shown on screen instead of a vague banner.
  const [agentJoinError, setAgentJoinError] = useState<string | null>(null);
  // The language choice is shared with the whole site (and remembered in a cookie). The call uses it and keeps it fixed until the call ends.
  const { language, setLanguage: chooseLanguage, s } = useLanguage();
  const [callLanguage, setCallLanguage] = useState<LangCode>(DEFAULT_LANGUAGE);
  // Voice: remembered per language in a cookie.
  const [voice, setVoiceState] = useState<string>(defaultVoice(language).id);
  useEffect(() => {
    const saved = readPrefCookie(voiceCookieName(language));
    setVoiceState(resolveVoice(language, saved).id);
  }, [language]);
  // Tapping a voice or a language plays a short sample of it (samples are static files, made once with `pnpm voice:samples`; Auto uses the Hindi ones).
  const preview = useVoicePreview();
  const sampleLang = (l: LangCode) => (l === 'auto' ? 'hi' : l);
  const chooseVoice = (id: string) => {
    setVoiceState(id);
    writePrefCookie(voiceCookieName(language), id);
    preview.play(sampleLang(language), id);
  };
  const pickLanguage = (code: LangCode) => {
    chooseLanguage(code);
    const saved = readPrefCookie(voiceCookieName(code));
    preview.play(sampleLang(code), resolveVoice(code, saved).id);
  };
  const playingVoice = preview.playing && preview.playing.startsWith(`${sampleLang(language)}:`) ? preview.playing.slice(sampleLang(language).length + 1) : null;

  const handleStartConversation = async (isAutoRetry?: boolean) => {
    preview.stop();
    if (isAutoRetry !== true) autoRetriesLeft.current = 1;
    setIsLoading(true);
    setError(null);
    setAgentJoinError(null);
    setCallLanguage(language);

    // Ask for the microphone first. The permission box can take a few seconds the first time, and the agent must not start (and greet) while it is open,
    // or the greeting is spoken before the person can hear it. A refusal also gets a clear message here, instead of a silent call.
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setError(s.micDenied);
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch RTC token + channel
      // console.log('Fetching Agora token...');
      const agoraResponse = await fetch('/api/generate-agora-token');
      if (agoraResponse.status === 401) {
        window.location.href = '/login?expired=1'; // demo session expired or cleared
        return;
      }
      const responseData = await agoraResponse.json();
      // console.log('Agora token response: uid =', responseData.uid, 'channel =', responseData.channel);

      if (!agoraResponse.ok) {
        throw new Error(
          `Failed to generate Agora token: ${JSON.stringify(responseData)}`,
        );
      }

      // 2. Run agent invite and RTM setup in parallel — both only need the token response.
      //    RTM must be ready before ConversationComponent mounts so AgoraVoiceAI
      //    can subscribe immediately. Agent invite is non-fatal.
      let blockedMessage: string | null = null; // the usage guard said "not now"
      const [agentData, rtm] = await Promise.all([
        // 2a. Start the AI agent
        fetch('/api/invite-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requester_id: responseData.uid,
            channel_name: responseData.channel,
            language,
            voice,
          } as ClientStartRequest),
        })
          .then(async (res) => {
            if (res.status === 401) {
              window.location.href = '/login?expired=1';
              return null;
            }
            if (res.status === 429) {
              const b = await res.json().catch(() => ({}));
              blockedMessage = b?.message ?? 'The demo is busy right now. Please try again in a few minutes.';
              return null;
            }
            if (!res.ok) {
              const body = await res.text().catch(() => '');
              let friendly: string | null = null;
              try {
                const parsedBody = JSON.parse(body) as { error?: string; message?: string };
                if (parsedBody.error === 'LOCAL_URL_NOT_REACHABLE') friendly = parsedBody.message ?? null;
              } catch { /* not JSON: show the raw text below */ }
              setAgentJoinError(friendly ?? `Agent start failed (HTTP ${res.status}). ${body.slice(0, 240)}`);
              return null;
            }
            return res.json() as Promise<AgentResponse>;
          })
          .catch((err) => {
            console.error('Failed to start conversation with agent:', err);
            setAgentJoinError(`Could not reach the agent service: ${String(err)}`);
            return null;
          }),

        // 2b. Set up RTM (dynamically imported to keep it client-only)
        (async () => {
          const { default: AgoraRTM } = await import('agora-rtm');
          const rtm: RTMClient = new AgoraRTM.RTM(
            process.env.NEXT_PUBLIC_AGORA_APP_ID!,
            responseData.uid,
          );
          rtmBufferRef.current?.stop();
          rtmBufferRef.current = startRtmBuffer(rtm); // listen from before login, so nothing the agent says is lost
          await rtm.login({ token: responseData.token });
          await rtm.subscribe(responseData.channel);
          // console.log('RTM ready, channel:', responseData.channel);
          return rtm;
        })(),
      ]);

      if (blockedMessage) {
        rtm.logout().catch(() => undefined);
        setError(blockedMessage);
        return;
      }

      // 3. All dependencies ready — store state and show conversation
      setRtmClient(rtm);
      setAgoraData({ ...responseData, agentId: agentData?.agent_id });
      setShowConversation(true);
    } catch (err) {
      setError(s.startFailed);
      console.error('Error starting conversation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenWillExpire = useCallback(
    async (uid: string): Promise<AgoraRenewalTokens> => {
      try {
        const channel = agoraData?.channel;
        if (!channel) {
          throw new Error('Missing channel for token renewal');
        }

        // RTC and RTM tokens are renewed independently:
        //   - RTC uses the browser client's assigned UID (passed in from ConversationComponent).
        //   - RTM uses the same UID that was used during RTM login (agoraData.uid).
        // Both are fetched in parallel to stay within the token-expiry grace-period window.
        const [rtcResponse, rtmResponse] = await Promise.all([
          fetch(`/api/generate-agora-token?channel=${channel}&uid=${uid}`),
          fetch(`/api/generate-agora-token?channel=${channel}&uid=${agoraData.uid}`),
        ]);
        const [rtcData, rtmData] = await Promise.all([
          rtcResponse.json(),
          rtmResponse.json(),
        ]);

        if (!rtcResponse.ok || !rtmResponse.ok) {
          throw new Error('Failed to generate renewal tokens');
        }

        return {
          rtcToken: rtcData.token,
          rtmToken: rtmData.token,
        };
      } catch (error) {
        console.error('Error renewing token:', error);
        throw error;
      }
    },
    [agoraData],
  );

  // One automatic retry per started call (used when the speech service could not connect). A tap on Start gives a new allowance.
  const autoRetriesLeft = useRef(1);
  const handleRestart = async (auto?: boolean) => {
    if (auto) autoRetriesLeft.current = 0;
    await handleEndConversation();
    await handleStartConversation(auto);
  };

  const handleEndConversation = async () => {
    // Stop the AI agent
    if (agoraData?.agentId) {
      try {
        // console.log('Stopping agent:', agoraData.agentId);
        const response = await fetch('/api/stop-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: agoraData.agentId }),
        });
        if (!response.ok) {
          console.error('Failed to stop agent:', await response.text());
        }
        // else console.log('Agent stopped successfully');
      } catch (error) {
        console.error('Error stopping agent:', error);
      }
    }

    // Tear down RTM — owned here since we created it here
    rtmBufferRef.current?.stop();
    rtmBufferRef.current = null;
    rtmClient?.logout().catch((err) => console.error('RTM logout error:', err));
    setRtmClient(null);
    setShowConversation(false);
    refreshOverview();
  };

  return (
    <div className="relative h-dvh overflow-hidden bg-asha-cream text-asha-ink">
      {!showConversation ? (
        hasCompletedSetup ? (
          <AshaWorkspace
            isStartingCall={isLoading}
            callError={error}
            onStartCall={handleStartConversation}
            language={language}
            onLanguageChange={pickLanguage}
            voice={voice}
            onVoiceChange={chooseVoice}
            playingVoice={playingVoice}
            overview={overview}
            isOverviewLoading={isOverviewLoading}
            overviewError={overviewError}
            isOverviewOffline={isOverviewOffline}
            overviewCachedAt={overviewCachedAt}
            onRefreshOverview={refreshOverview}
          />
        ) : (
          <StartScreen
            isLoading={isLoading}
            error={error}
            onStart={() => {
              markSetupDone();
              void handleStartConversation();
            }}
            onSkipToWorkspace={markSetupDone}
            language={language}
            onLanguageChange={pickLanguage}
            voice={voice}
            onVoiceChange={chooseVoice}
            playingVoice={playingVoice}
          />
        )
      ) : agoraData && rtmClient ? (
        <>
          {/* Non-fatal: the call screen still renders, but say exactly why the agent is missing. */}
          {agentJoinError && (
            <div
              role="alert"
              className="absolute inset-x-0 top-0 z-20 mx-auto max-w-md break-words bg-asha-red px-4 py-2 text-center text-sm font-medium text-white"
            >
              {agentJoinError}
            </div>
          )}
          {/* Browser-only conversation mount: RTC provider, error boundary, and lazy-loaded call UI. */}
          <Suspense fallback={<LoadingSkeleton />}>
            <ErrorBoundary>
              <AgoraProvider>
                <ConversationComponent
                  agoraData={agoraData}
                  rtmClient={rtmClient}
                  onTokenWillExpire={handleTokenWillExpire}
                  onEndConversation={handleEndConversation}
                  onRestart={handleRestart}
                  rtmBuffer={rtmBufferRef.current}
                  canAutoRetry={() => autoRetriesLeft.current > 0}
                  callLanguage={callLanguage}
                />
              </AgoraProvider>
            </ErrorBoundary>
          </Suspense>
        </>
      ) : (
        <p className="p-6 text-sm text-asha-muted">Failed to load conversation data.</p>
      )}
    </div>
  );
}
