import type { z } from 'zod';
import type { Db } from '@/lib/db/client';
import { logEvent } from '@/lib/db/repo';
import type { Notifier } from '@/lib/notify';
import type { ToolResult } from '@/lib/schemas';

export type ToolContext = {
  db: Db;
  ashaId: string;
  /** The Agora channel of this call. Ties tool calls and visits to one conversation for the dashboard. */
  sessionId: string | null;
  turnId: string;
  notifier: Notifier;
  now: () => Date;
};

/** An expected failure the voice agent can explain. Carries a Hindi line and an English hint for the model. */
export class ToolError extends Error {
  constructor(public code: string, public messageHi: string, public hint?: string) {
    super(code);
  }
}

export type ToolDef<I extends z.ZodTypeAny = z.ZodTypeAny, O = unknown> = {
  name: string;
  description: string;
  input: I;
  /** True for tools that change the outside world (WhatsApp). They must be idempotent. */
  sideEffect?: boolean;
  timeoutMs?: number;
  run: (input: z.infer<I>, ctx: ToolContext) => Promise<O>;
};

export function defineTool<I extends z.ZodTypeAny, O>(def: ToolDef<I, O>): ToolDef<I, O> {
  return def;
}

/**
 * Runs one tool call: validates input, enforces a timeout, records an event, and always returns a ToolResult.
 * Nothing thrown inside a tool ever escapes, so the agent can always say something sensible.
 */
export async function executeTool<I extends z.ZodTypeAny, O>(def: ToolDef<I, O>, raw: unknown, ctx: ToolContext): Promise<ToolResult<O>> {
  const t0 = Date.now();
  let result: ToolResult<O>;
  const parsed = def.input.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    result = {
      ok: false,
      code: 'BAD_INPUT',
      messageHi: 'मुझे यह जानकारी ठीक से समझ नहीं आई, कृपया दोबारा बताइए।',
      hint: `Invalid input${issue ? `: ${issue.path.join('.') || 'value'}: ${issue.message}` : ''}. Ask the ASHA to repeat, do not guess numbers.`,
    };
  } else {
    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new ToolError('TIMEOUT', 'यह काम अभी पूरा नहीं हो पाया।', 'The tool took too long. Try once more.')), def.timeoutMs ?? 6000).unref?.();
      });
      const data = await Promise.race([def.run(parsed.data, ctx), timeout]);
      result = { ok: true, data };
    } catch (e) {
      if (e instanceof ToolError) {
        result = { ok: false, code: e.code, messageHi: e.messageHi, hint: e.hint };
      } else {
        console.error(`[tool:${def.name}]`, e);
        result = { ok: false, code: 'TOOL_FAILED', messageHi: 'यह काम अभी नहीं हो पाया।', hint: 'Unexpected error. Tell the ASHA it did not work.' };
      }
    }
  }
  // Event logging must never break a tool call.
  try {
    await logEvent(ctx.db, {
      sessionId: ctx.sessionId, ashaId: ctx.ashaId, turnId: ctx.turnId, type: 'tool', name: def.name,
      input: parsed.success ? parsed.data : raw, output: result.ok ? result.data : { code: result.code, hint: result.hint },
      ok: result.ok, ms: Date.now() - t0,
    });
  } catch (e) {
    console.error('[events] could not log', e);
  }
  return result;
}
