import Link from 'next/link';
import { HeartPulse, Mic, ShieldCheck, FileText, BellRing } from 'lucide-react';
import { DemoStage } from './DemoStage';

const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-8';
const CTA =
  'inline-flex h-14 items-center justify-center rounded-full bg-asha-orange px-8 text-lg font-bold text-asha-night transition-colors hover:bg-[#E8863C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-orange/50';

const STEPS = [
  { t: 'Speak', d: 'Say who you visited and what you saw, the way you would tell a colleague.' },
  { t: 'Understand', d: 'Saathi picks out blood pressure, haemoglobin, weeks of pregnancy and symptoms.' },
  { t: 'Check', d: 'Fixed clinical rules set the risk level. The AI explains the result; it cannot change it.' },
  { t: 'Confirm', d: 'Saathi reads out the draft alert. Nothing is sent until you say haan.' },
  { t: 'Follow up', d: 'The doctor gets a WhatsApp message and the next visit goes on your list.' },
];

export function Landing() {
  return (
    <main className="bg-asha-cream text-asha-ink">
      {/* Hero */}
      <section className="relative overflow-hidden bg-asha-night text-white">
        <nav className={`${CONTAINER} flex h-20 items-center justify-between`} aria-label="Main">
          <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-asha-orange text-asha-night">
              <HeartPulse className="h-5 w-5" aria-hidden />
            </span>
            ASHA Saathi
          </Link>
          <Link
            href="/app"
            className="rounded-full border border-white/25 px-5 py-2 text-sm font-semibold transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Try it now
          </Link>
        </nav>

        <div className={`${CONTAINER} grid items-center gap-12 pb-20 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28 lg:pt-16`}>
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              Talk through the visit.
              <br />
              Saathi does the paperwork.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/80 sm:text-xl sm:leading-9">
              ASHA Saathi is a voice assistant for ASHA health workers. After a home visit, speak in Hindi, Kannada or
              English. It records the visit, checks for danger signs, and tells the doctor when a mother needs help.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/app" className={CTA}>
                Try it now
              </Link>
              <a
                href="#how"
                className="rounded-full px-4 py-3 text-base font-semibold text-white/85 underline decoration-white/30 underline-offset-8 hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 text-sm text-white/60">Runs in your browser. Needs a microphone. No sign-up.</p>
          </div>
          <DemoStage />
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 lg:py-28">
        <div className={`${CONTAINER} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}>
          <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Visits end in paper. Risks get found late.
          </h2>
          <dl className="divide-y divide-asha-line border-y border-asha-line">
            {[
              ['Paper registers', 'Notes are written after the visit, often hours later, and are hard to search or share.'],
              ['Danger signs are easy to miss', 'High blood pressure, severe anaemia and bleeding need action the same day.'],
              ['Doctors hear late', 'A call or a message depends on someone remembering to send it.'],
            ].map(([t, d]) => (
              <div key={t} className="grid gap-1 py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
                <dt className="text-lg font-bold">{t}</dt>
                <dd className="text-lg leading-8 text-asha-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* What it does */}
      <section className="bg-asha-sand py-20 lg:py-28">
        <div className={CONTAINER}>
          <h2 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            One conversation replaces the register, the checklist and the phone call.
          </h2>
          <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {[
              { i: Mic, t: 'Records the visit by voice', d: 'No forms to fill. Say it once and the visit is saved against the right mother.' },
              { i: ShieldCheck, t: 'Flags risk with fixed rules', d: 'Written rules decide high, watch or normal, and show the guideline behind each one.' },
              { i: FileText, t: 'Explains in plain words', d: 'Ask what to tell the family. Answers come from official guidelines, with the source shown.' },
              { i: BellRing, t: 'Alerts the doctor, once', d: 'After you say yes, one WhatsApp message goes out. Saying yes twice never sends two.' },
            ].map(({ i: Icon, t, d }) => (
              <div key={t} className="flex gap-4">
                <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-asha-teal text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-xl font-bold">{t}</h3>
                  <p className="mt-1 text-lg leading-8 text-asha-muted">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works: a real sequence, so numbered */}
      <section id="how" className="scroll-mt-4 py-20 lg:py-28">
        <div className={CONTAINER}>
          <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">How a visit goes</h2>
          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative">
                <span className="font-display text-5xl font-extrabold text-asha-orange" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-2 text-xl font-bold">{s.t}</h3>
                <p className="mt-2 text-base leading-7 text-asha-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Safety */}
      <section className="bg-asha-night py-20 text-white lg:py-28">
        <div className={`${CONTAINER} grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20`}>
          <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            The AI never decides who is high risk.
          </h2>
          <div className="space-y-5 text-lg leading-8 text-white/80">
            <p>
              Risk comes from written clinical rules that cite official guidance. Saathi uses AI to listen, explain and
              speak. It does not diagnose. It refers.
            </p>
            <p>Every alert is drafted first and sent only after you confirm out loud, so a mistake never reaches a doctor on its own.</p>
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="py-20 lg:py-28">
        <div className={CONTAINER}>
          <h2 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Speak the way you speak.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-asha-muted">
            Saathi replies in the language you used last. Switch in the middle of a call and it follows.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              ['नमस्ते दीदी', 'हिंदी'],
              ['ನಮಸ್ಕಾರ ಅಕ್ಕ', 'ಕನ್ನಡ'],
              ['Hello didi', 'English'],
            ].map(([hello, name]) => (
              <div key={name} className="border-t-4 border-asha-teal pt-5">
                <p className="text-3xl font-bold leading-10 sm:text-4xl sm:leading-[3rem]">{hello}</p>
                <p className="mt-2 text-lg text-asha-muted">{name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final call */}
      <section className="bg-asha-orange py-20 text-asha-night lg:py-24">
        <div className={`${CONTAINER} flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between`}>
          <h2 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Report a visit out loud and watch it get recorded.
          </h2>
          <Link
            href="/app"
            className="inline-flex h-14 shrink-0 items-center justify-center rounded-full bg-asha-night px-8 text-lg font-bold text-white transition-colors hover:bg-asha-night-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-asha-night/40"
          >
            Try it now
          </Link>
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
