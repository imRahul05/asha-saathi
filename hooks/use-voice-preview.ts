'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Plays the short pre-recorded sample of a voice (public/voice-samples/<language>-<voiceId>.mp3).
 * Only one sample plays at a time; picking another stops the first. `playing` is the key of the sample currently audible, so the screen
 * can show moving bars on exactly that card. Playback can be refused by the browser (no tap yet, blocked sound): that is ignored silently.
 */
export function useVoicePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const stop = useCallback(() => {
    const a = audio.current;
    if (a) { a.pause(); a.src = ''; }
    audio.current = null;
    setPlaying(null);
  }, []);

  const play = useCallback((language: string, voiceId: string) => {
    const key = `${language}:${voiceId}`;
    stop();
    try {
      const a = new Audio(`/voice-samples/${language}-${encodeURIComponent(voiceId)}.mp3`);
      audio.current = a;
      a.onplaying = () => { if (audio.current === a) setPlaying(key); };
      const done = () => { if (audio.current === a) { audio.current = null; setPlaying(null); } };
      a.onended = done;
      a.onerror = done;
      a.onpause = done;
      void a.play().catch(done);
    } catch {
      setPlaying(null);
    }
  }, [stop]);

  useEffect(() => stop, [stop]); // stop when the screen goes away

  return { play, stop, playing };
}
