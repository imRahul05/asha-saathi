import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Mic, ShieldCheck, FileText, BellRing } from 'lucide-react';
import { DemoStage } from './DemoStage';
import { HowSteps } from './HowSteps';
import { Reveal, WordReveal } from './Reveal';
import { StickyHeader } from './StickyHeader';

const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-8';
const CTA =
  'inline-flex h-14 items-center justify-center rounded-full bg-asha-orange px-8 text-lg font-bold text-asha-night transition-colors hover:bg-[#E8863C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-orange/50';

const STEPS = [
  { t: 'Speak', d: 'Say who you visited and what you saw, the way you would tell a colleague.' },
  { t: 'Understand', d: 'Saathi picks out blood pressure, haemoglobin, weeks of pregnancy and symptoms.' },
  { t: 'Check', d: 'Fixed clinical rules set the risk level. The AI explains the result; it cannot change it.' },
  { t: 'Confirm', d: 'Saathi reads out the draft alert. Nothing is sent until you say haan.' },
  { t: 'Follow up', d: 'The doctor gets a message with a one-tap voice call link, and the next visit goes on your list.' },
];

const rise = (i: number) => ({ '--i': i }) as CSSProperties;

export function Landing() {
  return (
    <main className="relative bg-asha-cream text-asha-ink">
      <StickyHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-asha-night text-white">
        <div className={`${CONTAINER} grid items-center gap-12 pb-20 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28 lg:pt-14`}>
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="hero-rise block" style={rise(0)}>
                Talk through the visit.
              </span>
              <span className="hero-rise block" style={rise(1)}>
                Saathi does the paperwork.
              </span>
            </h1>
            <p className="hero-rise mt-6 max-w-xl text-lg leading-8 text-white/80 sm:text-xl sm:leading-9" style={rise(2)}>
              ASHA Saathi is a voice assistant for ASHA health workers. After a home visit, speak in Hindi, Kannada, Tamil,
              English or five other languages. It records the visit, checks for danger signs, and tells the doctor when a mother needs help.
            </p>
            <div className="hero-rise mt-9 flex flex-wrap items-center gap-4" style={rise(3)}>
              <Link href="/app" prefetch={false} className={CTA}>
                Try it now
              </Link>
              <a
                href="#how"
                className="rounded-full px-4 py-3 text-base font-semibold text-white/85 underline decoration-white/30 underline-offset-8 hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                See how it works
              </a>
            </div>
            <p className="hero-rise mt-5 text-sm text-white/60" style={rise(4)}>
              Runs in your browser. Needs a microphone. No sign-up.
            </p>
          </div>
          <div className="hero-rise" style={rise(3)}>
            <DemoStage />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 lg:py-28">
        <div className={`${CONTAINER} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}>
          <Reveal as="h2" className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Visits end in paper. Risks get found late.
          </Reveal>
          <dl className="divide-y divide-asha-line border-y border-asha-line">
            {[
              ['Paper registers', 'Notes are written after the visit, often hours later, and are hard to search or share.'],
              ['Danger signs are easy to miss', 'High blood pressure, severe anaemia and bleeding need action the same day.'],
              ['Doctors hear late', 'A call or a message depends on someone remembering to send it.'],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 120} className="grid gap-1 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
                <dt className="text-lg font-bold">{t}</dt>
                <dd className="text-lg leading-8 text-asha-muted">{d}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* What it does */}
      <section className="bg-asha-sand py-20 lg:py-28">
        <div className={CONTAINER}>
          <Reveal as="h2" className="max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            One conversation replaces the register, the checklist and the phone call.
          </Reveal>
          <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {[
              { i: Mic, t: 'Records the visit by voice', d: 'No forms to fill. Say it once and the visit is saved against the right mother.' },
              { i: ShieldCheck, t: 'Flags risk with fixed rules', d: 'Written rules decide high, watch or normal, and show the guideline behind each one.' },
              { i: FileText, t: 'Explains in plain words', d: 'Ask what to tell the family. Answers come from official guidelines, with the source shown.' },
              { i: BellRing, t: 'Alerts the doctor, once', d: 'After you say yes, one message goes out with a link to talk by voice. Saying yes twice never sends two.' },
            ].map(({ i: Icon, t, d }, idx) => (
              <Reveal key={t} delay={(idx % 2) * 110} from={idx % 2 ? 'right' : 'left'} className="flex gap-4">
                <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-asha-teal text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-xl font-bold">{t}</h3>
                  <p className="mt-1 text-lg leading-8 text-asha-muted">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works: a real sequence, so numbered and progressive */}
      <section id="how" className="scroll-mt-24 py-20 lg:py-28">
        <div className={CONTAINER}>
          <Reveal as="h2" className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            How a visit goes
          </Reveal>
          <HowSteps steps={STEPS} />
        </div>
      </section>

      {/* Safety */}
      <section className="bg-asha-night py-20 text-white lg:py-28">
        <div className={`${CONTAINER} grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20`}>
          <WordReveal
            text="The AI never decides who is high risk."
            className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          />
          <Reveal delay={250} className="space-y-5 text-lg leading-8 text-white/80">
            <p>
              Risk comes from written clinical rules that cite official guidance. Saathi uses AI to listen, explain and
              speak. It does not diagnose. It refers.
            </p>
            <p>Every alert is drafted first and sent only after you confirm out loud, so a mistake never reaches a doctor on its own.</p>
          </Reveal>
        </div>
      </section>

      {/* Languages */}
      <section className="py-20 lg:py-28">
        <div className={CONTAINER}>
          <Reveal as="h2" className="max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Speak the way you speak.
          </Reveal>
          <Reveal as="p" delay={100} className="mt-4 max-w-xl text-lg leading-8 text-asha-muted">
            Pick your language before the call. Saathi listens and replies in it, start to finish.
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['नमस्ते दीदी', 'हिंदी'],
              ['ನಮಸ್ಕಾರ ಅಕ್ಕ', 'ಕನ್ನಡ'],
              ['வணக்கம் அக்கா', 'தமிழ்'],
              ['നമസ്കാരം ചേച്ചി', 'മലയാളം'],
              ['નમસ્તે બહેન', 'ગુજરાતી'],
              ['Hello didi', 'English'],
            ].map(([hello, name], i) => (
              <Reveal key={name} delay={i * 130} from="scale" className="border-t-4 border-asha-teal pt-5">
                <p className="text-3xl font-bold leading-10 sm:text-4xl sm:leading-[3rem]">{hello}</p>
                <p className="mt-2 text-lg text-asha-muted">{name}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final call */}
      <section className="bg-asha-orange py-20 text-asha-night lg:py-24">
        <div className={`${CONTAINER} flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between`}>
          <Reveal as="h2" className="max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Report a visit out loud and watch it get recorded.
          </Reveal>
          <Reveal delay={150} from="scale">
            <Link
              href="/app"
              prefetch={false}
              className="inline-flex h-14 shrink-0 items-center justify-center rounded-full bg-asha-night px-8 text-lg font-bold text-white transition-colors hover:bg-asha-night-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-night/40"
            >
              Try it now
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="bg-asha-night py-10 text-sm text-white/65">
        <div className={`${CONTAINER} flex flex-col gap-2 sm:flex-row sm:justify-between`}>
          <p>Built for Build with Agora, Bengaluru. A hackathon prototype using sample data.</p>
          <p>Voice by Agora Conversational AI and Murf Falcon.</p>
        </div>
      </footer>
    </main>
  );
}
