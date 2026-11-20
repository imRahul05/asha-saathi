// One-time Telegram setup. Run after you created the bot with @BotFather and tapped Start in it.
//   pnpm telegram:setup
// Reads TELEGRAM_BOT_TOKEN from .env.local, finds your chat id from the bot's latest messages, and saves
// TELEGRAM_CHAT_ID into .env.local. Prints no secrets.
import { readFileSync, writeFileSync } from 'node:fs';

async function api<T>(token: string, method: string): Promise<{ ok: boolean; result?: T; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { signal: AbortSignal.timeout(8000) });
  return res.json();
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set in .env.local');
    process.exit(1);
  }
  const me = await api<{ username: string; first_name: string }>(token, 'getMe');
  if (!me.ok) {
    console.error(`Telegram rejected the token: ${me.description}. Copy the full token from @BotFather again.`);
    process.exit(1);
  }
  console.log(`bot: @${me.result!.username}`);

  const updates = await api<Array<{ message?: { chat: { id: number; type: string; first_name?: string } } }>>(token, 'getUpdates');
  const chats = (updates.result ?? []).map((u) => u.message?.chat).filter((c): c is { id: number; type: string; first_name?: string } => !!c && c.type === 'private');
  if (chats.length === 0) {
    console.error(`No chat found yet. Open https://t.me/${me.result!.username} on the phone that should receive alerts, tap Start (or send any message), then run this again.`);
    process.exit(1);
  }
  const chat = chats[chats.length - 1];
  const file = '.env.local';
  const kept = readFileSync(file, 'utf8').split('\n').filter((l) => !l.startsWith('TELEGRAM_CHAT_ID=')).join('\n').replace(/\n+$/, '\n');
  writeFileSync(file, `${kept}TELEGRAM_CHAT_ID=${chat.id}\n`);
  console.log(`saved TELEGRAM_CHAT_ID for ${chat.first_name ?? 'your chat'} (id ends …${String(chat.id).slice(-3)}) to .env.local`);
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
