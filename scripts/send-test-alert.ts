// Sends one real test message through the alert notifier. Never prints secrets.
//   pnpm alerts:test                    full chain from .env.local: Telegram, then WhatsApp, then SMS
//   pnpm alerts:test --channel telegram force one channel: telegram | whatsapp | sms
//   pnpm alerts:test +91XXXXXXXXXX      send to that phone (WhatsApp/SMS); defaults to SEED_DOCTOR_PHONE
import { getNotifier, telegramNotifier, twilioNotifier, type Notifier } from '../lib/notify';

async function main() {
  const phone = process.argv.slice(2).find((a) => a.startsWith('+')) ?? process.env.SEED_DOCTOR_PHONE ?? null;
  const ci = process.argv.indexOf('--channel');
  const channel = ci > 0 ? process.argv[ci + 1] : null;

  let notifier: Notifier;
  if (channel === 'telegram') notifier = telegramNotifier(process.env);
  else if (channel === 'whatsapp' || channel === 'sms') notifier = twilioNotifier({ ...process.env, TWILIO_CHANNELS: channel });
  else notifier = getNotifier({ ...process.env, NOTIFIER: 'multi' });

  console.log(`notifier: ${notifier.name}${channel ? ` (${channel} only)` : ''}`);
  const res = await notifier.send({ name: 'Test', phone }, 'ASHA Saathi test alert: if you can read this, alerts reach this phone.', {
    sms: 'ASHA Saathi test alert: alerts reach this phone.',
  });
  console.log(`delivered via ${res.channel ?? notifier.name}, id ${res.providerId}`);
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
