// Notifier: how an alert reaches the doctor. Chosen by the NOTIFIER env var; business logic never names a vendor.

export type Recipient = { name: string | null; phone: string | null };
export interface Notifier {
  readonly name: string;
  send(to: Recipient, message: string): Promise<{ providerId: string | null }>;
}

/** Logs instead of sending. The dashboard still shows the alert as sent. Default when no provider is configured. */
export const consoleNotifier: Notifier = {
  name: 'console',
  async send(to, message) {
    console.log(`[notify:console] to=${to.name ?? '?'} ${to.phone ?? '(no phone)'}\n${message}`);
    return { providerId: `console-${Date.now()}` };
  },
};

/** Twilio WhatsApp (sandbox or approved sender), through the plain REST API, no SDK. */
export function twilioNotifier(env: NodeJS.ProcessEnv = process.env): Notifier {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886';
  if (!sid || !token) throw new Error('NOTIFIER=twilio needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
  return {
    name: 'twilio',
    async send(to, message) {
      if (!to.phone) throw new Error('The doctor has no phone number saved');
      const body = new URLSearchParams({ To: `whatsapp:${to.phone}`, From: from, Body: message });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(8000),
      });
      const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok) throw new Error(`Twilio ${res.status}: ${json.message ?? 'send failed'}`);
      return { providerId: json.sid ?? null };
    },
  };
}

export function getNotifier(env: NodeJS.ProcessEnv = process.env): Notifier {
  return env.NOTIFIER === 'twilio' ? twilioNotifier(env) : consoleNotifier;
}
