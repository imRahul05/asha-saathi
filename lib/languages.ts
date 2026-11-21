// Languages a call can run in. The speech recogniser is set per call (Deepgram nova-3 monolingual codes), because
// Deepgram's "multi" code-switching mode is not built for most Indian languages and mis-hears accented English as
// Telugu or Urdu. Sources: Deepgram language overview, Agora real-time transcription supported languages.
//
// Translations of greetings and failure lines are machine-written and need a native speaker's check before real use.

export type LangCode = 'hi' | 'en' | 'kn' | 'ta' | 'te' | 'gu' | 'bn' | 'mr' | 'ml' | 'auto';

export type LanguageConfig = {
  code: LangCode;
  name: string;
  native: string;
  /** Deepgram nova-3 language code (asr params) */
  deepgram: string;
  /** Agora turn-detection language(s). The SDK only accepts a fixed list that excludes Malayalam and Marathi, so those use the nearest accepted tag. */
  agora: string[];
  /** Murf Falcon locale for the voice */
  murf: string;
  /** What the agent says first, and when it did not understand */
  greeting: string;
  failure: string;
  /** How the agent addresses the ASHA: the local word for "elder sister" (didi), in the language's own script so the voice pronounces it correctly */
  address: string;
  /** true when this language's Agora tag is a stand-in (see `agora`) */
  standIn?: boolean;
  /** Key words and number words in this language, given to the model so it does not mis-hear BP values or symptoms. Needs a native speaker's review. */
  glossary: string;
};

export const LANGUAGES: Record<LangCode, LanguageConfig> = {
  hi: { code: 'hi', glossary: 'BP = ब्लड प्रेशर / बी पी; swelling = सूजन; 100 = सौ / एक सौ; 150 = एक सौ पचास; 120 = एक सौ बीस; 90 = नब्बे; 80 = अस्सी', name: 'Hindi', native: 'हिंदी', deepgram: 'hi', agora: ['hi-IN'], murf: 'hi-IN', address: 'दीदी',
    greeting: 'नमस्ते दीदी! किसके घर visit हुई?', failure: 'माफ़ कीजिए, फिर से बोलिए।' },
  en: { code: 'en', glossary: 'BP = blood pressure; swelling = swelling of feet or legs', name: 'English', native: 'English', deepgram: 'en-IN', agora: ['en-IN'], murf: 'en-IN', address: 'didi',
    greeting: 'Hello didi! Whose home did you visit?', failure: 'Sorry, please say that again.' },
  kn: { code: 'kn', glossary: 'BP = ರಕ್ತದೊತ್ತಡ; swelling = ಊತ; 100 = ನೂರು; 150 = ನೂರ ಐವತ್ತು; 120 = ನೂರ ಇಪ್ಪತ್ತು; 90 = ತೊಂಬತ್ತು; 80 = ಎಂಬತ್ತು', name: 'Kannada', native: 'ಕನ್ನಡ', deepgram: 'kn', agora: ['kn-IN'], murf: 'kn-IN', address: 'ಅಕ್ಕ',
    greeting: 'ನಮಸ್ಕಾರ ಅಕ್ಕ! ಯಾರ ಮನೆಗೆ ಭೇಟಿ ನೀಡಿದಿರಿ?', failure: 'ಕ್ಷಮಿಸಿ, ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.' },
  ta: { code: 'ta', glossary: 'BP = இரத்த அழுத்தம்; swelling = வீக்கம்; 100 = நூறு; 150 = நூற்று ஐம்பது; 120 = நூற்று இருபது; 90 = தொண்ணூறு; 80 = எண்பது', name: 'Tamil', native: 'தமிழ்', deepgram: 'ta', agora: ['ta-IN'], murf: 'ta-IN', address: 'அக்கா',
    greeting: 'வணக்கம் அக்கா! யார் வீட்டிற்குச் சென்றீர்கள்?', failure: 'மன்னிக்கவும், மீண்டும் சொல்லுங்கள்.' },
  te: { code: 'te', glossary: 'BP = రక్తపోటు; swelling = వాపు; 100 = వంద; 150 = నూట యాభై; 120 = నూట ఇరవై; 90 = తొంభై; 80 = ఎనభై', name: 'Telugu', native: 'తెలుగు', deepgram: 'te', agora: ['te-IN'], murf: 'te-IN', address: 'అక్కా',
    greeting: 'నమస్కారం అక్కా! ఎవరి ఇంటికి వెళ్లారు?', failure: 'క్షమించండి, దయచేసి మళ్లీ చెప్పండి.' },
  gu: { code: 'gu', glossary: 'BP = બ્લડ પ્રેશર; swelling = સોજો; 100 = એકસો; 150 = એકસો પચાસ; 120 = એકસો વીસ; 90 = નેવું; 80 = એંસી', name: 'Gujarati', native: 'ગુજરાતી', deepgram: 'gu', agora: ['gu-IN'], murf: 'gu-IN', address: 'બહેન',
    greeting: 'નમસ્તે બહેન! તમે કોના ઘરે મુલાકાત લીધી?', failure: 'માફ કરશો, કૃપા કરીને ફરી કહો.' },
  bn: { code: 'bn', glossary: 'BP = রক্তচাপ; swelling = ফোলা; 100 = একশো; 150 = দেড়শো; 120 = একশো কুড়ি; 90 = নব্বই; 80 = আশি', name: 'Bengali', native: 'বাংলা', deepgram: 'bn', agora: ['bn-IN'], murf: 'bn-IN', address: 'দিদি',
    greeting: 'নমস্কার দিদি! কার বাড়িতে গিয়েছিলেন?', failure: 'দুঃখিত, আবার বলুন।' },
  mr: { code: 'mr', glossary: 'BP = रक्तदाब; swelling = सूज; 100 = शंभर; 150 = दीडशे; 120 = एकशे वीस; 90 = नव्वद; 80 = ऐंशी', name: 'Marathi', native: 'मराठी', deepgram: 'mr', agora: ['hi-IN'], murf: 'mr-IN', address: 'ताई', standIn: true,
    greeting: 'नमस्कार ताई! कोणाच्या घरी भेट दिली?', failure: 'क्षमस्व, कृपया पुन्हा सांगा.' },
  ml: { code: 'ml', glossary: 'BP = രക്തസമ്മർദ്ദം; swelling = നീർക്കെട്ട് / വീക്കം (a symptom of swollen feet, NOT leaking fluid); 100 = നൂറ്; 150 = നൂറ്റമ്പത്; 120 = നൂറ്റിയിരുപത്; 90 = തൊണ്ണൂറ്; 80 = എൺപത്', name: 'Malayalam', native: 'മലയാളം', deepgram: 'ml', agora: ['en-IN'], murf: 'ml-IN', address: 'ചേച്ചി', standIn: true,
    greeting: 'നമസ്കാരം ചേച്ചി! ആരുടെ വീട്ടിലാണ് സന്ദർശിച്ചത്?', failure: 'ക്ഷമിക്കണം, ദയവായി വീണ്ടും പറയൂ.' },
  // Experimental: lets Deepgram guess the language per sentence. It is unreliable for accented English and most Indian languages.
  auto: { code: 'auto', glossary: 'BP = ब्लड प्रेशर; swelling = सूजन / ಊತ; 100 = सौ / ನೂರು; 150 = एक सौ पचास', name: 'Auto-detect', native: 'Auto (beta)', deepgram: 'multi', agora: ['hi-IN', 'kn-IN', 'en-IN'], murf: 'hi-IN', address: 'दीदी',
    greeting: 'नमस्ते दीदी! किसके घर visit हुई?', failure: 'माफ़ कीजिए, फिर से बोलिए।' },
};

export const LANGUAGE_ORDER: LangCode[] = ['hi', 'en', 'kn', 'ta', 'te', 'gu', 'bn', 'mr', 'ml', 'auto'];
export const DEFAULT_LANGUAGE: LangCode = 'hi';

export function isLangCode(v: unknown): v is LangCode {
  return typeof v === 'string' && v in LANGUAGES;
}
