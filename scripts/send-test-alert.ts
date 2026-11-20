// Sends one real test message through the alert notifier. Never prints secrets.
//   pnpm alerts:test                                      full chain from .env.local: Telegram, then WhatsApp, then SMS
//   pnpm alerts:test --channel telegram                   force one channel: telegram | whatsapp | sms
//   pnpm alerts:test --channel telegram --sample high     send a realistic alert: urgent | high | watch | normal
//   pnpm alerts:test +91XXXXXXXXXX                        send to that phone (WhatsApp/SMS); defaults to SEED_DOCTOR_PHONE
import { getNotifier, telegramNotifier, twilioNotifier, type Notifier } from '../lib/notify';
import { composeAlertMessage, composeSmsText } from '../lib/alerts/message';
import type { Asha, Beneficiary, Visit } from '../lib/db/repo';

type Level = 'urgent' | 'high' | 'watch' | 'normal';

function sample(level: Level): { message: string; sms: string } {
  const visit = {
    riskLevel: level, gestationWeeks: 28, bpSys: level === 'normal' ? 118 : level === 'watch' ? 128 : 150, bpDia: level === 'normal' ? 76 : level === 'watch' ? 84 : 100,
    hb: level === 'watch' ? 9.5 : null, symptoms: level === 'urgent' ? ['bleeding'] : level === 'high' ? ['swelling_feet'] : [],
    riskReasons: level === 'urgent' ? [{ text: 'Vaginal bleeding in pregnancy needs urgent referral to a CHC or higher centre' }]
      : level === 'high' ? [{ text: 'BP 150/100 is 140/90 or higher. Repeat after 6 hours to confirm' }]
      : level === 'watch' ? [{ text: 'Hb 9.5 g/dL is below 11: anaemia' }] : [],
  } as unknown as Visit;
  const b = { name: 'Sunita Devi', village: 'Narsapura' } as Beneficiary;
  const asha = { name: 'Meena Kumari' } as Asha;
  return { message: composeAlertMessage(visit, b, asha), sms: composeSmsText(visit, b, asha) };
}

async function main() {
  const phone = process.argv.slice(2).find((a) => a.startsWith('+')) ?? process.env.SEED_DOCTOR_PHONE ?? null;
  const flag = (name: string) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : null;
  };
  const channel = flag('--channel');
  const level = flag('--sample') as Level | null;

  let notifier: Notifier;
  if (channel === 'telegram') notifier = telegramNotifier(process.env);
  else if (channel === 'whatsapp' || channel === 'sms') notifier = twilioNotifier({ ...process.env, TWILIO_CHANNELS: channel });
  else notifier = getNotifier({ ...process.env, NOTIFIER: 'multi' });

  const content = level
    ? sample(level)
    : { message: 'ASHA Saathi test alert: if you can read this, alerts reach this phone.', sms: 'ASHA Saathi test alert: alerts reach this phone.' };
  console.log(`notifier: ${notifier.name}${channel ? ` (${channel} only)` : ''}${level ? `, sample: ${level}` : ''}`);
  const res = await notifier.send({ name: 'Test', phone }, content.message, { sms: content.sms });
  console.log(`delivered via ${res.channel ?? notifier.name}, id ${res.providerId}`);
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
