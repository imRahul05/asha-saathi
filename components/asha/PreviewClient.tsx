'use client';

import { useState } from 'react';
import { VoiceScreen, type TranscriptMessage } from '@/components/asha/VoiceScreen';
import { DEV_SNAPSHOT } from '@/lib/asha/fixtures';
import type { OrbState } from '@/lib/asha/lang';
import { LANGUAGES } from '@/lib/languages';
import { stringsFor } from '@/lib/i18n';

// DEV ONLY design preview with sample data. Not reachable in production (see app/preview/page.tsx).
const STATES: OrbState[] = ['joining', 'not-joined', 'listening', 'thinking', 'speaking', 'muted', 'disconnected'];

const HINDI: TranscriptMessage[] = [
  { uid: 1, turn_id: 1, text: 'नमस्ते दीदी! किसके घर visit हुई?' },
  { uid: 2, turn_id: 2, text: 'सुनीता जी के घर गई थी, सात महीने, BP 150 by 100, पैरों में सूजन है।' },
  { uid: 1, turn_id: 3, text: 'सुनीता जी का BP 150/100 है, यह high risk है। डॉक्टर को alert भेजूँ?' },
];
const KANNADA: TranscriptMessage[] = [
  { uid: 1, turn_id: 1, text: 'ನಮಸ್ಕಾರ ಅಕ್ಕ! ಯಾರ ಮನೆಗೆ ಭೇಟಿ ನೀಡಿದಿರಿ?' },
  { uid: 2, turn_id: 2, text: 'ಸುನೀತಾ ಅವರ ಮನೆಗೆ ಹೋಗಿದ್ದೆ, ಏಳು ತಿಂಗಳು, BP 150 by 100, ಕಾಲು ಊದಿಕೊಂಡಿದೆ.' },
];
const ENGLISH: TranscriptMessage[] = [
  { uid: 1, turn_id: 1, text: LANGUAGES.en.greeting },
  { uid: 2, turn_id: 2, text: 'I visited Sunita ji, seven months, BP 150 by 100, swelling in the feet.' },
];
const SETS = { hi: HINDI, kn: KANNADA, en: ENGLISH, empty: [] as TranscriptMessage[] };

const pill = (active: boolean, tone: string) => `rounded-full px-3 py-1 ${active ? `${tone} text-white` : 'bg-white'}`;

export function PreviewClient() {
  const [screen, setScreen] = useState<'voice' | 'dashboard'>('voice');
  const [state, setState] = useState<OrbState>('listening');
  const [set, setSet] = useState<keyof typeof SETS>('hi');
  const [problem, setProblem] = useState(false);
  const [withVisit, setWithVisit] = useState(true);

  // Schedule scenario: open on the Schedule tab, optionally with no planned visits (empty state).
  const [startTab, setStartTab] = useState<'talk' | 'schedule'>('talk');
  const [emptySchedule, setEmptySchedule] = useState(false);

  const base = withVisit ? DEV_SNAPSHOT : { ...DEV_SNAPSHOT, visit: null, events: [], counts: { visits: 0, highRisk: 0, alertsSent: 0, followUps: 0 } };
  const snapshot = emptySchedule ? { ...base, schedule: [] } : base;

  return (
    <div className="bg-asha-sand">
      <p className="mx-auto max-w-md px-3 pt-3 text-xs font-semibold text-asha-red lg:max-w-7xl">DEV PREVIEW · sample data · not available in production</p>
      <div className="mx-auto flex max-w-md flex-wrap gap-2 p-3 text-xs lg:max-w-7xl">
        {(['voice', 'dashboard'] as const).map((s) => (
          <button key={s} onClick={() => setScreen(s)} className={pill(screen === s, 'bg-asha-night')}>
            screen: {s}
          </button>
        ))}
        {screen === 'voice' && (
          <>
            {STATES.map((s) => (
              <button key={s} onClick={() => setState(s)} className={pill(state === s, 'bg-asha-teal')}>{s}</button>
            ))}
            {(Object.keys(SETS) as (keyof typeof SETS)[]).map((k) => (
              <button key={k} onClick={() => setSet(k)} className={pill(set === k, 'bg-asha-orange')}>{k}</button>
            ))}
            <button onClick={() => setProblem((p) => !p)} className={pill(problem, 'bg-asha-red')}>problem banner</button>
            <button onClick={() => setWithVisit((p) => !p)} className={pill(withVisit, 'bg-asha-teal')}>saved visit</button>
            <button onClick={() => setStartTab((t) => (t === 'schedule' ? 'talk' : 'schedule'))} className={pill(startTab === 'schedule', 'bg-asha-night')}>schedule tab</button>
            <button onClick={() => setEmptySchedule((p) => !p)} className={pill(emptySchedule, 'bg-asha-night')}>empty schedule</button>
          </>
        )}
      </div>

      {screen === 'voice' ? (
        <VoiceScreen
          key={startTab}
          initialTab={startTab}
          callLanguage={set === 'empty' ? 'hi' : set}
          orbState={state}
          messageList={SETS[set]}
          currentInProgressMessage={null}
          agentUID="1"
          onToggleMic={() => setState((s) => (s === 'muted' ? 'listening' : 'muted'))}
          onEnd={() => undefined}
          problem={problem ? { text: stringsFor(set === 'empty' ? 'hi' : set).errAsrFinal, onRetry: () => setProblem(false), detail: 'agent: asr: Connection timeout after 10 seconds (code 1000)' } : null}
          snapshot={snapshot}
        />
      ) : (
        <p className="p-6 text-sm">The live dashboard reads /api/dashboard. Open <a className="underline" href="/dashboard">/dashboard</a>.</p>
      )}
    </div>
  );
}
