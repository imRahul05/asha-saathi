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

/** Wraps the first line that contains text (skipping an emoji-only banner line) with a bold marker pair. */
function boldHeadline(text: string, open: string, close: string): string {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => /[A-Za-z\u0900-\u097F]/.test(l));
  if (i >= 0) lines[i] = `${open}${lines[i]}${close}`;
  return lines.join('\n');
}
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
          const providerId = await sendVia(channel, to.phone, channel === 'sms' ? (opts?.sms ?? message.slice(0, 110)) : boldHeadline(message, '*', '*')); // WhatsApp: *bold*
          return { providerId, channel: `twilio-${channel}` };
        } catch (e) {
          failures.push(`${channel}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      throw new Error(failures.join(' | '));
    },
  };
}

/**
 * Telegram bot message. No join step and no 24-hour window: after the person taps Start in the bot once,
 * the bot can message them any time. Needs TELEGRAM_BOT_TOKEN and the person's chat id (TELEGRAM_CHAT_ID).
 * Note: normal bot chats are not end-to-end encrypted.
 */
export function telegramNotifier(env: NodeJS.ProcessEnv = process.env): Notifier {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  const base = (env.TELEGRAM_API_BASE ?? 'https://api.telegram.org').replace(/\/$/, '');
  if (!token || !chatId) throw new Error('Telegram needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID');
  return {
    name: 'telegram',
    async send(_to, message) {
      const res = await fetch(`${base}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: boldHeadline(escapeHtml(message), '<b>', '</b>'), parse_mode: 'HTML', disable_web_page_preview: true }),
        signal: AbortSignal.timeout(6000),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; error_code?: number; result?: { message_id?: number } };
      if (!res.ok || !json.ok) throw new Error(`error ${json.error_code ?? res.status}: ${json.description ?? 'send failed'}`);
      return { providerId: json.result?.message_id != null ? String(json.result.message_id) : null, channel: 'telegram' };
    },
  };
}

/** Tries each notifier in order and stops at the first that delivers. If all fail, the error lists every reason. */
export function chainNotifier(name: string, notifiers: Notifier[]): Notifier {
  return {
    name,
    async send(to, message, opts) {
      const failures: string[] = [];
      for (const n of notifiers) {
        try {
          const r = await n.send(to, message, opts);
          return { providerId: r.providerId, channel: r.channel ?? n.name };
        } catch (e) {
          failures.push(`${n.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      throw new Error(failures.join(' | '));
    },
  };
}

/**
 * NOTIFIER=console (default)  logs only
 * NOTIFIER=twilio             WhatsApp, then SMS
 * NOTIFIER=multi              Telegram (if configured), then WhatsApp, then SMS
 */
export function getNotifier(env: NodeJS.ProcessEnv = process.env): Notifier {
  if (env.NOTIFIER === 'twilio') return twilioNotifier(env);
  if (env.NOTIFIER === 'multi') {
    const list: Notifier[] = [];
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) list.push(telegramNotifier(env));
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) list.push(twilioNotifier(env));
    if (list.length === 0) throw new Error('NOTIFIER=multi needs Telegram or Twilio credentials');
    return chainNotifier('alerts', list);
  }
  return consoleNotifier;
}
