import type { Db } from '@/lib/db/client';

export class NoTemplateError extends Error {
  constructor() {
    super('No template ASHA exists. Run pnpm db:seed first.');
  }
}

/**
 * Creates a private demo ASHA for one visitor: a copy of the template ASHA and her registered mothers.
 * Visits, alerts and follow-ups the visitor makes belong to this copy only, so demo users never see each other.
 * Demo accounts older than 24 hours are deleted here (cascade removes their visits, alerts, follow-ups).
 */
export async function createDemoAsha(db: Db): Promise<{ id: string; name: string }> {
  await db.query(`delete from ashas where is_demo and created_at < now() - interval '24 hours'`);
  const tpl = await db.query<{ id: string }>(`select id from ashas where not is_demo order by created_at asc limit 1`);
  if (!tpl[0]) throw new NoTemplateError();
  const created = await db.query<{ id: string; name: string }>(
    `insert into ashas (name, phone, phc_name, doctor_name, doctor_phone, language, is_demo)
     select name, phone, phc_name, doctor_name, doctor_phone, language, true from ashas where id = $1
     returning id, name`,
    [tpl[0].id],
  );
  const demo = created[0];
  await db.query(
    `insert into beneficiaries (asha_id, name, aliases, village, phone, age, parity, lmp)
     select $2, name, aliases, village, phone, age, parity, lmp from beneficiaries where asha_id = $1`,
    [tpl[0].id, demo.id],
  );
  return demo;
}
