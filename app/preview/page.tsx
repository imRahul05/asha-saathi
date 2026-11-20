'use client';

import { useState } from 'react';
import { VoiceScreen, type TranscriptMessage } from '@/components/asha/VoiceScreen';
import type { OrbState } from '@/lib/asha/lang';

// Design preview with SAMPLE data: no Agora session, no agent-minutes used.
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
  { uid: 1, turn_id: 1, text: 'Hello didi! Whose home did you visit?' },
  { uid: 2, turn_id: 2, text: 'I visited Sunita ji, seven months, BP 150 by 100, swelling in the feet.' },
];
const SETS = { hi: HINDI, kn: KANNADA, en: ENGLISH, empty: [] as TranscriptMessage[] };

export default function PreviewPage() {
  const [state, setState] = useState<OrbState>('listening');
  const [set, setSet] = useState<keyof typeof SETS>('hi');
  const [problem, setProblem] = useState(false);

  return (
    <div className="bg-asha-sand">
      <div className="mx-auto flex max-w-md flex-wrap gap-2 p-3 text-xs">
        {STATES.map((s) => (
          <button key={s} onClick={() => setState(s)} className={`rounded-full px-3 py-1 ${state === s ? 'bg-asha-teal text-white' : 'bg-white'}`}>
            {s}
          </button>
        ))}
        {(Object.keys(SETS) as (keyof typeof SETS)[]).map((k) => (
          <button key={k} onClick={() => setSet(k)} className={`rounded-full px-3 py-1 ${set === k ? 'bg-asha-orange text-white' : 'bg-white'}`}>
            {k}
          </button>
        ))}
        <button onClick={() => setProblem((p) => !p)} className={`rounded-full px-3 py-1 ${problem ? 'bg-asha-red text-white' : 'bg-white'}`}>
          problem banner
        </button>
      </div>
      <VoiceScreen
        orbState={state}
        messageList={SETS[set]}
        currentInProgressMessage={null}
        agentUID="1"
        onToggleMic={() => setState((s) => (s === 'muted' ? 'listening' : 'muted'))}
        onEnd={() => undefined}
        problem={problem ? { text: 'TTS: 401 invalid api key', onRetry: () => setProblem(false) } : null}
      />
    </div>
  );
}
