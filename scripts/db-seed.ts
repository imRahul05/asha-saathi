// Creates the first ASHA and her registered mothers so the app has someone to talk about.
//   pnpm db:seed             adds them only if no ASHA exists yet
//   pnpm db:seed -- --reset  wipes all data first (asks you to type RESET)
//
// Set SEED_DOCTOR_PHONE (E.164, e.g. +919876543210) to the phone that should receive WhatsApp alerts.
import { makeDb } from '../lib/db/client';
import { createInterface } from 'node:readline/promises';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Add your Neon connection string to .env.local, then run: pnpm db:migrate && pnpm db:seed');
    process.exit(1);
  }
  const sql = makeDb(url);

  if (process.argv.includes('--reset')) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('This DELETES all ASHAs, mothers, visits, alerts and events. Type RESET to continue: ');
    rl.close();
    if (answer.trim() !== 'RESET') {
      console.log('Cancelled.');
      return;
    }
    await sql.query('truncate events, followups, alerts, visits, beneficiaries, ashas restart identity cascade');
  }

  const existing = await sql.query<{ n: number }>('select count(*)::int as n from ashas');
  if (existing[0].n > 0) {
    console.log('An ASHA already exists. Nothing to do. (Use --reset to start over.)');
    return;
  }

  const doctorPhone = process.env.SEED_DOCTOR_PHONE ?? null;
  if (!doctorPhone) console.warn('SEED_DOCTOR_PHONE is not set: alerts cannot be drafted until the doctor has a phone number. Update it later in the ashas table.');

  const [asha] = (await sql.query<{ id: string }>(
    `insert into ashas (name, phone, phc_name, doctor_name, doctor_phone, language)
     values ('Meena Kumari', null, 'Kolar PHC', $1, $2, 'hi') returning id`,
    [process.env.SEED_DOCTOR_NAME ?? 'Dr. Rao', doctorPhone],
  ));

  const weeksAgo = (w: number) => new Date(Date.now() - w * 7 * 86_400_000).toISOString().slice(0, 10);
  const mothers: Array<[string, string[], string, number, number, number]> = [
    // name, aliases (so Hindi/Kannada spellings match), village, age, parity, weeks pregnant
    ['Sunita Devi', ['सुनीता', 'सुनीता देवी', 'ಸುನೀತಾ'], 'Narsapura', 24, 1, 28],
    ['Lakshmi B', ['लक्ष्मी', 'ಲಕ್ಷ್ಮಿ'], 'Hosahalli', 17, 0, 18],
    ['Asha Rani', ['आशा रानी', 'आशा', 'ಆಶಾ'], 'Narsapura', 29, 2, 34],
    ['Pooja K', ['पूजा', 'ಪೂಜಾ'], 'Malur', 22, 0, 12],
    ['Kavitha M', ['कविता', 'ಕವಿತಾ'], 'Malur', 36, 3, 30],
    ['Sunita Kumari', ['सुनीता कुमारी'], 'Hosahalli', 31, 2, 22],
  ];
  for (const [name, aliases, village, age, parity, weeks] of mothers) {
    await sql.query(
      `insert into beneficiaries (asha_id, name, aliases, village, age, parity, lmp) values ($1,$2,$3,$4,$5,$6,$7)`,
      [asha.id, name, aliases, village, age, parity, weeksAgo(weeks)],
    );
  }
  console.log(`Created ASHA Meena Kumari (${asha.id}) with ${mothers.length} registered mothers.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
