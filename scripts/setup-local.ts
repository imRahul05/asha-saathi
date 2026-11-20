// Checks that your local environment can run the app, and fills in what it safely can.
//   pnpm setup:local
// Reads .env and .env.local (never prints values), generates missing secrets into .env.local, and lists what you still need to add.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function load(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trimStart().startsWith('#')) out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...load('.env'), ...load('.env.local') };
const has = (k: string) => Boolean(env[k]);

// Names people often mistype, and what they should be.
const TYPOS: Record<string, string> = {
  APP_ID: 'NEXT_PUBLIC_AGORA_APP_ID',
  APP_CERTIFICATE: 'NEXT_AGORA_APP_CERTIFICATE',
  APP_DERTIFICATE: 'NEXT_AGORA_APP_CERTIFICATE',
  TWILIO_SID: 'TWILIO_ACCOUNT_SID',
  TIWLIO_PHONE_NUMBER: 'TWILIO_PHONE_NUMBER',
  TWILIO_AUTH: 'TWILIO_AUTH_TOKEN',
};

const generated: string[] = [];
const append: string[] = [];
function ensureSecret(name: string, bytes: number) {
  if (!has(name)) {
    append.push(`${name}=${randomBytes(bytes).toString('hex')}`);
    generated.push(name);
  }
}
ensureSecret('MCP_SHARED_SECRET', 24);
ensureSecret('SESSION_SECRET', 32);
ensureSecret('DASHBOARD_KEY', 12);
// Without NOTIFIER the app only LOGS alerts (the screen says "sent" but nothing reaches a phone). If delivery credentials exist, turn delivery on.
const canDeliver = has('TELEGRAM_BOT_TOKEN') || has('TWILIO_ACCOUNT_SID');
if (!has('NOTIFIER') && canDeliver) {
  append.push('NOTIFIER=multi');
  generated.push('NOTIFIER=multi (alerts go to Telegram, then WhatsApp, then SMS)');
}
if (!has('NOTIFIER') && !canDeliver) {
  console.log('Note: no Telegram or Twilio credentials, so alerts are only logged (test mode). Add them to send real messages.\n');
}
if (!has('MURF_VOICE_ID')) {
  append.push('MURF_VOICE_ID=Pooja');
  generated.push('MURF_VOICE_ID (default Pooja)');
}
if (append.length) {
  const cur = existsSync('.env.local') ? readFileSync('.env.local', 'utf8').replace(/\n*$/, '\n') : '';
  writeFileSync('.env.local', cur + append.join('\n') + '\n');
}

const required: Array<[string, string]> = [
  ['NEXT_PUBLIC_AGORA_APP_ID', 'Agora Console, your project, App ID'],
  ['NEXT_AGORA_APP_CERTIFICATE', 'Agora Console, your project, App Certificate'],
  ['DATABASE_URL', 'your Neon connection string (then run: pnpm db:migrate && pnpm db:seed)'],
  ['MURF_API_KEY', 'Murf dashboard, API key'],
];
let problems = 0;
console.log('Local setup check (values are never printed):\n');
for (const [name, where] of required) {
  if (has(name)) console.log(`  ok       ${name}`);
  else {
    problems++;
    const typo = Object.keys(TYPOS).find((t) => TYPOS[t] === name && has(t));
    console.log(`  MISSING  ${name}  <- ${where}${typo ? `  (you have ${typo}: rename it to ${name})` : ''}`);
  }
}
for (const name of generated) console.log(`  created  ${name}  (saved to .env.local)`);
for (const [typo, right] of Object.entries(TYPOS)) if (has(typo) && !has(right)) console.log(`  note     ${typo} is not read by the app, use ${right}`);

console.log('\nOptional: NOTIFIER, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.');
console.log('\nImportant: Agora cannot reach localhost. To test the voice agent from your machine, set PUBLIC_BASE_URL to a public URL');
console.log('(a tunnel such as `cloudflared tunnel --url http://localhost:3000`, or your deployed URL). Sign-in and the screens work without it.');
console.log(problems ? `\n${problems} required value(s) missing. Add them to .env.local and run this again.` : '\nReady. Run: pnpm dev');
process.exit(problems ? 1 : 0);
