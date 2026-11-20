'use client';

import { useState } from 'react';
import { VoiceScreen, type TranscriptMessage } from '@/components/asha/VoiceScreen';
import { RiskResult } from '@/components/asha/RiskResult';
import { AlertSent } from '@/components/asha/AlertSent';
import { SAMPLE_VISIT } from '@/lib/asha/fixtures';
import type { OrbState } from '@/lib/asha/lang';

// Design preview with SAMPLE data: no Agora session, no agent-minutes used.
const STATES: OrbState[] = ['joining', 'not-joined', 'listening', 'thinking', 'speaking', 'muted', 'disconnected'];
const SCREENS = ['voice', 'risk', 'alert'] as const;

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
  { uid: 1, turn_id: 1, text: 'Hello didi! Whose home did you visit?' },
  { uid: 2, turn_id: 2, text: 'I visited Sunita ji, seven months, BP 150 by 100, swelling in the feet.' },
];
const SETS = { hi: HINDI, kn: KANNADA, en: ENGLISH, empty: [] as TranscriptMessage[] };

const pill = (active: boolean, tone: string) =>
  `rounded-full px-3 py-1 ${active ? `${tone} text-white` : 'bg-white'}`;

export default function PreviewPage() {
  const [screen, setScreen] = useState<(typeof SCREENS)[number]>('voice');
  const [state, setState] = useState<OrbState>('listening');
  const [set, setSet] = useState<keyof typeof SETS>('hi');
  const [problem, setProblem] = useState(false);
  const [alertStatus, setAlertStatus] = useState<'draft' | 'sent' | 'failed'>('sent');

  const visit = { ...SAMPLE_VISIT, alert: { ...SAMPLE_VISIT.alert, status: alertStatus } };

  return (
    <div className="bg-asha-sand">
      <div className="mx-auto flex max-w-md flex-wrap gap-2 p-3 text-xs lg:max-w-7xl">
        {SCREENS.map((s) => (
          <button key={s} onClick={() => setScreen(s)} className={pill(screen === s, 'bg-asha-night')}>
            screen: {s}
          </button>
        ))}
        {screen === 'voice' && (
          <>
            {STATES.map((s) => (
              <button key={s} onClick={() => setState(s)} className={pill(state === s, 'bg-asha-teal')}>
                {s}
              </button>
            ))}
            {(Object.keys(SETS) as (keyof typeof SETS)[]).map((k) => (
              <button key={k} onClick={() => setSet(k)} className={pill(set === k, 'bg-asha-orange')}>
                {k}
              </button>
            ))}
            <button onClick={() => setProblem((p) => !p)} className={pill(problem, 'bg-asha-red')}>
              problem banner
            </button>
          </>
        )}
        {screen === 'alert' &&
          (['draft', 'sent', 'failed'] as const).map((a) => (
            <button key={a} onClick={() => setAlertStatus(a)} className={pill(alertStatus === a, 'bg-asha-teal')}>
              alert: {a}
            </button>
          ))}
      </div>

      {screen === 'voice' && (
        <VoiceScreen
          orbState={state}
          messageList={SETS[set]}
          currentInProgressMessage={null}
          agentUID="1"
          onToggleMic={() => setState((s) => (s === 'muted' ? 'listening' : 'muted'))}
          onEnd={() => undefined}
          problem={problem ? { text: 'TTS: 401 invalid api key', onRetry: () => setProblem(false) } : null}
        />
      )}
      {screen === 'risk' && (
        <div className="mx-auto max-w-md lg:max-w-3xl lg:px-6 lg:pb-10">
          <RiskResult visit={SAMPLE_VISIT} />
        </div>
      )}
      {screen === 'alert' && (
        <div className="mx-auto max-w-md lg:max-w-3xl lg:px-6 lg:pb-10">
          <AlertSent visit={visit} />
        </div>
      )}
    </div>
  );
}
