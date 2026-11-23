import type { Db } from './client';
import type { CheckedVisit, Extraction, Transcript } from '@/lib/scribe/types';

// SQL for Visit Scribe. Every function takes a Db and every read is scoped to one ASHA, so nobody can reach another ASHA's recording.

export type ScribeStatus = 'recording' | 'processing' | 'ready' | 'saved' | 'failed' | 'discarded';
export type Candidate = { id: string; name: string; village: string | null };
export type Scribe = {
  id: string;
  ashaId: string;
  clientId: string;
  language: string;
  mime: string;
  status: ScribeStatus;
  chunkCount: number | null;
  durationSec: number | null;
  transcript: Transcript | null;
  extraction: Extraction | null;
  checked: CheckedVisit | null;
  candidates: Candidate[];
  errorCode: string | null;
  visitId: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = Record<string, unknown>;
const json = <T>(v: unknown): T | null => (v == null ? null : typeof v === 'string' ? (JSON.parse(v) as T) : (v as T));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const toScribe = (r: Row): Scribe => ({
  id: String(r.id),
  ashaId: String(r.asha_id),
  clientId: String(r.client_id),
  language: String(r.language),
  mime: String(r.mime),
  status: r.status as ScribeStatus,
  chunkCount: r.chunk_count == null ? null : Number(r.chunk_count),
  durationSec: r.duration_sec == null ? null : Number(r.duration_sec),
  transcript: json<Transcript>(r.transcript),
  extraction: json<Extraction>(r.extraction),
  checked: json<CheckedVisit>(r.checked),
  candidates: json<Candidate[]>(r.candidates) ?? [],
  errorCode: (r.error_code as string) ?? null,
  visitId: (r.visit_id as string) ?? null,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

/** Starts a recording. The same clientId from the same ASHA returns the recording that already exists, so a retry after a dropped connection never makes a second one. */
export async function startScribe(db: Db, v: { ashaId: string; clientId: string; language: string; mime: string }): Promise<Scribe> {
  await db.query(
    `insert into visit_scribes (asha_id, client_id, language, mime) values ($1,$2,$3,$4) on conflict (asha_id, client_id) do nothing`,
    [v.ashaId, v.clientId, v.language, v.mime],
  );
  const rows = await db.query<Row>('select * from visit_scribes where asha_id = $1 and client_id = $2', [v.ashaId, v.clientId]);
  return toScribe(rows[0]);
}

export async function getScribe(db: Db, ashaId: string, id: string): Promise<Scribe | null> {
  const rows = await db.query<Row>('select * from visit_scribes where asha_id = $1 and id = $2', [ashaId, id]);
  return rows[0] ? toScribe(rows[0]) : null;
}

/** Stores one piece. Sending the same piece again replaces it. */
export async function putChunk(db: Db, scribeId: string, idx: number, dataB64: string): Promise<void> {
  await db.query(
    `insert into scribe_chunks (scribe_id, idx, data_b64) values ($1,$2,$3)
     on conflict (scribe_id, idx) do update set data_b64 = excluded.data_b64`,
    [scribeId, idx, dataB64],
  );
}

export async function chunkIndexes(db: Db, scribeId: string): Promise<number[]> {
  const rows = await db.query<{ idx: number }>('select idx from scribe_chunks where scribe_id = $1 order by idx', [scribeId]);
  return rows.map((r) => Number(r.idx));
}

/** Size of everything uploaded so far, as stored text. Used to stop one recording growing without limit. */
export async function chunkBytes(db: Db, scribeId: string): Promise<number> {
  const rows = await db.query<{ n: string | number }>('select coalesce(sum(length(data_b64)), 0) as n from scribe_chunks where scribe_id = $1', [scribeId]);
  return Number(rows[0]?.n ?? 0);
}

export async function readChunks(db: Db, scribeId: string): Promise<string[]> {
  const rows = await db.query<{ data_b64: string }>('select data_b64 from scribe_chunks where scribe_id = $1 order by idx', [scribeId]);
  return rows.map((r) => r.data_b64);
}

export async function deleteChunks(db: Db, scribeId: string): Promise<void> {
  await db.query('delete from scribe_chunks where scribe_id = $1', [scribeId]);
}

/** Takes the recording for processing, once. Returns null if it is already being processed or is already finished, so two requests never run it twice. */
export async function claimForProcessing(db: Db, ashaId: string, id: string, chunkCount: number): Promise<Scribe | null> {
  const rows = await db.query<Row>(
    `update visit_scribes set status = 'processing', chunk_count = $3, error_code = null, updated_at = now()
     where asha_id = $1 and id = $2 and status in ('recording', 'failed') returning *`,
    [ashaId, id, chunkCount],
  );
  return rows[0] ? toScribe(rows[0]) : null;
}

export async function markReady(
  db: Db,
  id: string,
  r: { transcript: Transcript; extraction: Extraction; checked: CheckedVisit; candidates: Candidate[]; durationSec: number | null },
): Promise<Scribe> {
  const rows = await db.query<Row>(
    `update visit_scribes set status = 'ready', transcript = $2::jsonb, extraction = $3::jsonb, checked = $4::jsonb, candidates = $5::jsonb,
       duration_sec = $6, error_code = null, updated_at = now() where id = $1 returning *`,
    [id, JSON.stringify(r.transcript), JSON.stringify(r.extraction), JSON.stringify(r.checked), JSON.stringify(r.candidates), r.durationSec],
  );
  return toScribe(rows[0]);
}

export async function markFailed(db: Db, id: string, errorCode: string): Promise<void> {
  await db.query(`update visit_scribes set status = 'failed', error_code = $2, updated_at = now() where id = $1`, [id, errorCode]);
}

/** Takes the recording for saving, once. Returns null if it is not ready or somebody already took it, so two taps never make two visits. */
export async function claimForSaving(db: Db, ashaId: string, id: string): Promise<Scribe | null> {
  const rows = await db.query<Row>(
    `update visit_scribes set status = 'saved', updated_at = now() where asha_id = $1 and id = $2 and status = 'ready' returning *`,
    [ashaId, id],
  );
  return rows[0] ? toScribe(rows[0]) : null;
}

export async function attachVisit(db: Db, id: string, visitId: string): Promise<void> {
  await db.query('update visit_scribes set visit_id = $2, updated_at = now() where id = $1', [id, visitId]);
}

/** The visit could not be saved after all: make the recording ready again so the ASHA can try once more. */
export async function releaseSaving(db: Db, id: string): Promise<void> {
  await db.query(`update visit_scribes set status = 'ready', updated_at = now() where id = $1 and status = 'saved' and visit_id is null`, [id]);
}

/** The ASHA throws the recording away: the audio and the transcript go with it. */
export async function discardScribe(db: Db, ashaId: string, id: string): Promise<boolean> {
  const rows = await db.query<Row>(
    `update visit_scribes set status = 'discarded', transcript = null, extraction = null, checked = null, candidates = '[]'::jsonb, updated_at = now()
     where asha_id = $1 and id = $2 and status <> 'saved' returning id`,
    [ashaId, id],
  );
  if (rows.length) await deleteChunks(db, id);
  return rows.length > 0;
}
