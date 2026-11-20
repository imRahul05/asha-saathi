// Notifier: how an alert reaches the doctor. Chosen by the NOTIFIER env var; business logic never names a vendor.

export type Recipient = { name: string | null; phone: string | null };
export type SendResult = { providerId: string | null; /** which channel delivered it, e.g. "whatsapp" or "sms" */ channel?: string };
export interface Notifier {
  readonly name: string;
  send(to: Recipient, message: string, opts?: { sms?: string }): Promise<SendResult>;
}

/** Logs instead of sending. The dashboard still shows the alert as sent. Default when no provider is configured. */
export const consoleNotifier: Notifier = {
  name: 'console',
  async send(to, message) {
    console.log(`[notify:console] to=${to.name ?? '?'} ${to.phone ?? '(no phone)'}\n${message}`);
    return { providerId: `console-${Date.now()}`, channel: 'console' };
  },
};

type TwilioChannel = 'whatsapp' | 'sms';

/**
 * Twilio through the plain REST API (no SDK). Tries the channels in TWILIO_CHANNELS order (default "whatsapp,sms"):
 * - whatsapp: the sandbox or an approved WhatsApp sender. The doctor must have joined the sandbox (it lapses after 3 days).
 * - sms: from TWILIO_PHONE_NUMBER. On a trial account the recipient must be a verified number.
 * If WhatsApp fails (for example the sandbox join lapsed) the alert still goes out as SMS.
 */
export function twilioNotifier(env: NodeJS.ProcessEnv = process.env): Notifier {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886';
  const smsFrom = env.TWILIO_PHONE_NUMBER;
  const base = (env.TWILIO_API_BASE ?? 'https://api.twilio.com').replace(/\/$/, '');
  if (!sid || !token) throw new Error('NOTIFIER=twilio needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
  const channels = (env.TWILIO_CHANNELS ?? 'whatsapp,sms')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is TwilioChannel => c === 'whatsapp' || c === 'sms');
  if (channels.length === 0) throw new Error('TWILIO_CHANNELS must list whatsapp and/or sms');
  if (channels.includes('sms') && !smsFrom && channels.length === 1) throw new Error('SMS needs TWILIO_PHONE_NUMBER');

  async function sendVia(channel: TwilioChannel, phone: string, message: string): Promise<string | null> {
    const from = channel === 'whatsapp' ? whatsappFrom : smsFrom;
    if (!from) throw new Error('TWILIO_PHONE_NUMBER is not set');
    const to = channel === 'whatsapp' ? `whatsapp:${phone}` : phone;
    const res = await fetch(`${base}/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Body: message }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok) throw new Error(`${json.code ? `error ${json.code}: ` : `HTTP ${res.status}: `}${json.message ?? 'send failed'}`);
    // Twilio accepts a message and only THEN reports many failures (for example error 63015: the phone has not joined
    // the WhatsApp sandbox). Watch the status briefly so a failed channel really falls through to the next one.
    if (json.sid) await confirmNotFailed(json.sid);
    return json.sid ?? null;
  }

  const KNOWN: Record<number, string> = {
    63015: 'the phone has not joined the WhatsApp sandbox (or the join lapsed after 3 days): send the join phrase again',
    63016: 'outside the WhatsApp 24-hour window: the phone must message the sandbox number first',
    63007: 'the WhatsApp sender is not set up for this account',
  };

  async function confirmNotFailed(messageSid: string, maxMs = 3000): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const res = await fetch(`${base}/2010-04-01/Accounts/${sid}/Messages/${messageSid}.json`, {
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);
      const j = res && res.ok ? ((await res.json().catch(() => ({}))) as { status?: string; error_code?: number | null; error_message?: string | null }) : null;
      if (j) {
        if (j.status === 'failed' || j.status === 'undelivered') {
          throw new Error(`error ${j.error_code ?? '?'}: ${(j.error_code && KNOWN[j.error_code]) || j.error_message || 'delivery failed'}`);
        }
        if (j.status === 'sent' || j.status === 'delivered' || j.status === 'read') return;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    // Still queued after the wait: assume it is on its way.
  }

  return {
    name: 'twilio',
    async send(to, message, opts) {
      if (!to.phone) throw new Error('The doctor has no phone number saved');
      const failures: string[] = [];
      for (const channel of channels) {
        try {
          const providerId = await sendVia(channel, to.phone, channel === 'sms' ? (opts?.sms ?? message.slice(0, 110)) : message);
          return { providerId, channel };
        } catch (e) {
          failures.push(`${channel}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      throw new Error(failures.join(' | '));
    },
  };
}

export function getNotifier(env: NodeJS.ProcessEnv = process.env): Notifier {
  return env.NOTIFIER === 'twilio' ? twilioNotifier(env) : consoleNotifier;
}
