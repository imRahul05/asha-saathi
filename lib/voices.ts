import type { LangCode } from '@/lib/languages';

// Murf Falcon voices offered per call language. IDs come from the voice list of our Murf account (GET /v1/speech/voices?model=FALCON).
// "Pooja" is the multilingual voice used so far; Murf lists it for Hindi, English, Kannada, Tamil and Telugu only, so Gujarati, Bengali,
// Marathi and Malayalam get their own native voices. The first voice of each list is the default.
export type Gender = 'female' | 'male';
export type VoiceOption = { id: string; name: string; gender: Gender };

const v = (id: string, name: string, gender: Gender): VoiceOption => ({ id, name, gender });
const POOJA = v('Pooja', 'Pooja', 'female');

const HINDI: VoiceOption[] = [
  POOJA,
  v('hi-IN-khyati', 'Khyati', 'female'),
  v('hi-IN-poonam', 'Poonam', 'female'),
  v('hi-IN-neeta', 'Neeta', 'female'),
  v('hi-IN-chirag', 'Chirag', 'male'),
  v('hi-IN-aman', 'Aman', 'male'),
];

export const VOICES: Record<LangCode, VoiceOption[]> = {
  hi: HINDI,
  en: [POOJA, v('en-IN-isha', 'Isha', 'female'), v('en-IN-arohi', 'Arohi', 'female'), v('en-IN-priya', 'Priya', 'female'), v('en-IN-nikhil', 'Nikhil', 'male'), v('en-IN-samar', 'Samar', 'male')],
  kn: [POOJA, v('kn-IN-harshitha', 'Harshitha', 'female')],
  ta: [POOJA, v('ta-IN-karthikeyan', 'Karthikeyan', 'male')],
  te: [POOJA],
  gu: [v('gu-IN-diya', 'Diya', 'female'), v('gu-IN-hardik', 'Hardik', 'male')],
  bn: [v('bn-IN-ishani', 'Ishani', 'female'), v('bn-IN-debarati', 'Debarati', 'female'), v('bn-IN-arnab', 'Arnab', 'male'), v('bn-IN-subhankar', 'Subhankar', 'male')],
  mr: [v('mr-IN-prajakta', 'Prajakta', 'female'), v('mr-IN-prathamesh', 'Prathamesh', 'male')],
  ml: [v('ml-IN-nimisha', 'Nimisha', 'female'), v('ml-IN-madhavan', 'Madhavan', 'male')],
  auto: HINDI,
};

export const defaultVoice = (lang: LangCode): VoiceOption => VOICES[lang][0];

/** The requested voice if it is offered for this language, otherwise the language's default. The server uses this, so a browser cannot ask for any other voice. */
export function resolveVoice(lang: LangCode, id: string | null | undefined): VoiceOption {
  return VOICES[lang].find((x) => x.id === id) ?? defaultVoice(lang);
}
