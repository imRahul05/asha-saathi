'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { Strings } from '@/lib/i18n';

/** A small text box at the bottom of the conversation: type instead of speaking (noisy surroundings). Enter sends. */
export function TypeBox({ onSend, disabled, s }: { onSend: (text: string) => Promise<void> | void; disabled?: boolean; s: Strings }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy || disabled) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSend(t);
      setText('');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="sticky bottom-0 -mx-1 mt-auto bg-asha-cream/95 px-1 pb-1 pt-2 backdrop-blur lg:bg-transparent lg:backdrop-blur-none">
      <div className="flex items-center gap-2 rounded-full border border-asha-line bg-white py-1 pl-4 pr-1 shadow-sm focus-within:ring-2 focus-within:ring-asha-teal">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          disabled={disabled}
          placeholder={s.typePlaceholder}
          aria-label={s.typePlaceholder}
          enterKeyHint="send"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-asha-muted disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || busy || !text.trim()}
          aria-label={s.sendText}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-asha-teal px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-asha-teal/50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {s.sendText}
        </button>
      </div>
      {failed && <p role="alert" className="mt-1 px-3 text-xs font-semibold text-asha-red">{s.sendError}</p>}
    </form>
  );
}
