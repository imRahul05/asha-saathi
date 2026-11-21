'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { Loader2, Mic, MicOff, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type Summary = {
  mother: string; village: string | null; weeks: number | null; bp: string | null; hb: number | null;
  symptoms: string[]; risk: 'normal' | 'watch' | 'high' | 'urgent'; reasons: string[]; ashaName: string; doctorName: string;
};
type Join = { appId: string; channel: string; uid: number; token: string; role: 'doctor' | 'asha'; summary: Summary };
type Phase = 'ready' | 'joining' | 'live' | 'ended' | 'error';

const RISK_STYLE: Record<Summary['risk'], string> = {
  urgent: 'bg-asha-red text-white', high: 'bg-asha-red text-white', watch: 'bg-asha-amber text-[#7A4E0A]', normal: 'bg-asha-mint text-asha-teal',
};
const ERRORS: Record<string, string> = {
  LINK_INVALID: 'This call link has expired or is not valid. Ask for a new alert.',
  NOT_FOUND: 'This visit could not be found.',
  NOT_ALLOWED: 'Allow the microphone in your browser to join the call.',
  NETWORK: 'Could not reach the server. Check the connection and try again.',
};

// Browser voice call between the ASHA and the doctor. Audio only (low bandwidth). Nothing starts until the person taps Join,
// which is also what lets the browser play remote audio and ask for the microphone.
export function CallRoom({ link }: { link: string }) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<Join | null>(null);
  const [muted, setMuted] = useState(false);
  const [remote, setRemote] = useState(false); // is the other person in the call
  const [heard, setHeard] = useState(false); // are we receiving their audio
  const [seconds, setSeconds] = useState(0);
  const client = useRef<IAgoraRTCClient | null>(null);
  const mic = useRef<IMicrophoneAudioTrack | null>(null);

  // Load the visit summary first (no mic yet) so the page is useful before joining.
  useEffect(() => {
    let off = false;
    fetch('/api/call/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: link }) })
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (off) return;
        if (ok) setInfo(body as Join);
        else { setError(ERRORS[body?.error] ?? 'Could not open this call.'); setPhase('error'); }
      })
      .catch(() => { if (!off) { setError(ERRORS.NETWORK); setPhase('error'); } });
    return () => { off = true; };
  }, [link]);

  useEffect(() => {
    if (phase !== 'live') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Tell the server a join/leave happened so the visit timeline shows the call. Best effort: never blocks or breaks the call.
  const reported = useRef<'joined' | 'left' | null>(null);
  const report = useCallback((type: 'joined' | 'left') => {
    try {
      if (reported.current === type) return;
      reported.current = type;
      const body = JSON.stringify({ t: link, type });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon?.('/api/call/event', body)) return;
      void fetch('/api/call/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    } catch { /* ignore */ }
  }, [link]);

  const leave = useCallback(async () => {
    report('left');
    try { mic.current?.stop(); mic.current?.close(); } catch { /* already closed */ }
    mic.current = null;
    try { await client.current?.leave(); } catch { /* already left */ }
    client.current = null;
    setRemote(false); setHeard(false);
    setPhase('ended');
  }, [report]);

  useEffect(() => { // a closed tab or navigation does not run effect cleanups reliably, so report from pagehide too
    const onHide = () => { if (client.current) report('left'); };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [report]);

  useEffect(() => () => { // leave when the page is closed
    if (client.current) report('left');
    try { mic.current?.close(); } catch { /* ignore */ }
    client.current?.leave().catch(() => {});
  }, [report]);

  const join = async () => {
    if (!info) return;
    setPhase('joining'); setError(null);
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      AgoraRTC.setLogLevel(3);
      const c = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }); // Communication profile
      client.current = c;
      c.on('user-published', async (user, type) => {
        if (type !== 'audio') return;
        await c.subscribe(user, 'audio');
        user.audioTrack?.play();
        setRemote(true); setHeard(true);
      });
      c.on('user-unpublished', (_u, type) => { if (type === 'audio') setHeard(false); });
      c.on('user-joined', () => setRemote(true));
      c.on('user-left', () => { setRemote(false); setHeard(false); });
      await c.join(info.appId, info.channel, info.token, info.uid);
      try {
        mic.current = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
      } catch {
        await c.leave(); client.current = null;
        setError(ERRORS.NOT_ALLOWED); setPhase('ready');
        return;
      }
      await c.publish(mic.current);
      reported.current = null; report('joined');
      setSeconds(0); setPhase('live');
    } catch (e) {
      console.error('[call] join failed', e);
      try { await client.current?.leave(); } catch { /* ignore */ }
      client.current = null;
      setError('Could not join the call. Check the connection and try again.'); setPhase('ready');
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    await mic.current?.setEnabled(!next);
    setMuted(next);
  };

  const s = info?.summary;
  const other = info?.role === 'doctor' ? s?.ashaName : s?.doctorName;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 bg-asha-cream px-4 py-6 text-asha-ink sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">ASHA Saathi call</h1>
        <p className="text-base text-asha-muted">Voice call over the internet. No app needed.</p>
      </header>

      {phase === 'error' && (
        <p role="alert" className="rounded-2xl bg-asha-red-soft p-4 text-base font-semibold text-asha-red">{error}</p>
      )}

      {s && (
        <section aria-label="Visit summary" className="rounded-3xl border border-asha-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">{s.mother}</h2>
            <span className={cn('rounded-full px-3 py-1 text-sm font-bold uppercase', RISK_STYLE[s.risk])}>{s.risk}</span>
          </div>
          <p className="mt-1 text-base text-asha-muted">
            {[s.village, s.weeks ? `${s.weeks} weeks` : null].filter(Boolean).join(' · ')}
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-lg font-semibold">
            {s.bp && <li>BP {s.bp}</li>}
            {s.hb != null && <li>Hb {s.hb}</li>}
            {s.symptoms.map((x) => <li key={x}>{x.replace(/_/g, ' ')}</li>)}
          </ul>
          {s.reasons.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-base text-asha-muted">
              {s.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
        </section>
      )}

      {info && phase !== 'error' && (
        <section aria-label="Call" className="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl bg-asha-night p-6 text-center text-white">
          <p className="text-lg text-white/80" aria-live="polite">
            {phase === 'ready' && `Join to talk with ${other}.`}
            {phase === 'joining' && 'Joining…'}
            {phase === 'live' && (remote ? (heard ? `Connected with ${other}` : `${other} is muted`) : `Waiting for ${other} to join…`)}
            {phase === 'ended' && 'Call ended.'}
          </p>
          {phase === 'live' && <p className="font-display text-4xl font-extrabold tabular-nums">{clock}</p>}
          {error && phase === 'ready' && <p role="alert" className="max-w-sm text-base font-semibold text-asha-amber">{error}</p>}

          {(phase === 'ready' || phase === 'joining') && (
            <button
              type="button" onClick={join} disabled={phase === 'joining'}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-asha-orange px-8 text-lg font-bold text-asha-night focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-orange/50 disabled:opacity-70"
            >
              {phase === 'joining' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
              Join call
            </button>
          )}
          {phase === 'live' && (
            <div className="flex gap-4">
              <button
                type="button" onClick={toggleMute} aria-pressed={muted}
                className={cn('flex h-14 items-center gap-2 rounded-full px-6 text-lg font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50', muted ? 'bg-white text-asha-night' : 'bg-white/15 text-white')}
              >
                {muted ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button" onClick={leave}
                className="flex h-14 items-center gap-2 rounded-full bg-asha-red px-6 text-lg font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
              >
                <PhoneOff className="h-5 w-5" aria-hidden /> Leave
              </button>
            </div>
          )}
          {phase === 'ended' && (
            <button type="button" onClick={() => { setMuted(false); setPhase('ready'); }} className="rounded-full border border-white/30 px-6 py-3 text-base font-semibold">
              Join again
            </button>
          )}
        </section>
      )}
      {!info && phase === 'ready' && <p className="text-center text-asha-muted">Opening call…</p>}
    </main>
  );
}
