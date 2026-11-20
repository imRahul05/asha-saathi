// Language helpers for the ASHA Saathi UI. The voice pipeline is multilingual (one Murf voice,
// Deepgram `multi` ASR, LLM replies in the user's language). The UI just mirrors what was spoken.

export type Lang = 'hi' | 'kn' | 'en';
export type LangChoice = Lang | 'auto';

export const LANG_NAME: Record<Lang, string> = { hi: 'हिंदी', kn: 'ಕನ್ನಡ', en: 'English' };

const DEVANAGARI = /[ऀ-ॿ]/g;
const KANNADA = /[ಀ-೿]/g;
const LATIN = /[A-Za-z]/g;

/** Script-based detection of the language of a spoken/typed message. Returns null if there is no signal. */
export function detectLang(text?: string | null): Lang | null {
  if (!text) return null;
  const d = text.match(DEVANAGARI)?.length ?? 0;
  const k = text.match(KANNADA)?.length ?? 0;
  const l = text.match(LATIN)?.length ?? 0;
  if (d === 0 && k === 0 && l < 4) return null;
  if (k > d && k >= l / 3) return 'kn';
  if (d >= k && d > 0 && d >= l / 3) return 'hi';
  return l >= 4 ? 'en' : null;
}

export type OrbState =
  | 'joining'
  | 'not-joined'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'disconnected';

// NOTE: Kannada strings need a native-speaker check before the demo.
export const ORB_LABEL: Record<Lang, Record<OrbState, string>> = {
  hi: {
    joining: 'जुड़ रही हूँ…',
    'not-joined': 'साथी अभी जुड़ी नहीं…',
    listening: 'सुन रही हूँ…',
    thinking: 'सोच रही हूँ…',
    speaking: 'बोल रही हूँ…',
    muted: 'माइक बंद है',
    disconnected: 'कनेक्शन टूट गया',
  },
  kn: {
    joining: 'ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇನೆ…',
    'not-joined': 'ಸಾಥಿ ಇನ್ನೂ ಸೇರಿಲ್ಲ…',
    listening: 'ಕೇಳುತ್ತಿದ್ದೇನೆ…',
    thinking: 'ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ…',
    speaking: 'ಹೇಳುತ್ತಿದ್ದೇನೆ…',
    muted: 'ಮೈಕ್ ಆಫ್ ಆಗಿದೆ',
    disconnected: 'ಸಂಪರ್ಕ ಕಡಿತವಾಯಿತು',
  },
  en: {
    joining: 'Connecting…',
    'not-joined': "Saathi hasn't joined yet…",
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
    muted: 'Mic is off',
    disconnected: 'Disconnected',
  },
};

export const UI_TEXT: Record<Lang, { saathi: string; you: string; empty: string; end: string; start: string; tapToStart: string }> = {
  hi: {
    saathi: 'साथी',
    you: 'आप',
    empty: 'बोलना शुरू कीजिए, यहाँ बातचीत दिखेगी।',
    end: 'बात खत्म',
    start: 'बात शुरू करें',
    tapToStart: 'शुरू करने के लिए टैप करें',
  },
  kn: {
    saathi: 'ಸಾಥಿ',
    you: 'ನೀವು',
    empty: 'ಮಾತನಾಡಿ, ಸಂಭಾಷಣೆ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ.',
    end: 'ಮಾತು ಮುಗಿಸಿ',
    start: 'ಮಾತು ಪ್ರಾರಂಭಿಸಿ',
    tapToStart: 'ಪ್ರಾರಂಭಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
  },
  en: {
    saathi: 'Saathi',
    you: 'You',
    empty: 'Start speaking and the conversation will show here.',
    end: 'End call',
    start: 'Start talking',
    tapToStart: 'Tap to start',
  },
};
