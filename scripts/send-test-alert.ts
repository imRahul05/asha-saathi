// Sends one real test message through the configured notifier. Never prints secrets.
//   pnpm twilio:test +91XXXXXXXXXX                 uses NOTIFIER and TWILIO_* from .env.local
//   pnpm twilio:test +91XXXXXXXXXX --channel sms   force one channel (whatsapp or sms)
import { twilioNotifier, getNotifier } from '../lib/notify';

async function main() {
  const phone = process.argv.slice(2).find((a) => a.startsWith('+'));
  if (!phone) {
    console.error('Usage: pnpm twilio:test +91XXXXXXXXXX [--channel whatsapp|sms]');
    process.exit(2);
  }
  const ci = process.argv.indexOf('--channel');
  const env = ci > 0 ? { ...process.env, NOTIFIER: 'twilio', TWILIO_CHANNELS: process.argv[ci + 1] } : process.env;
  const notifier = env.NOTIFIER === 'twilio' ? twilioNotifier(env) : getNotifier(env);
  console.log(`notifier: ${notifier.name}${env.TWILIO_CHANNELS ? ` (channels: ${env.TWILIO_CHANNELS})` : ''}`);
  const res = await notifier.send({ name: 'Test', phone }, 'ASHA Saathi test alert: if you can read this, alerts reach this phone.');
  console.log(`sent via ${res.channel ?? notifier.name}, id ${res.providerId}`);
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
