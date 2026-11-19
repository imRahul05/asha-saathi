// SPIKE: minimal MCP server (streamable HTTP) hosting ONE tool for Agora's managed LLM.
// Auth: Bearer secret (MCP_SHARED_SECRET). Input validated with zod. Every call is logged.
import { createMcpHandler } from 'mcp-handler';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EchoVisitInput = z.object({
  bp_sys: z.number().int().min(50).max(300),
  bp_dia: z.number().int().min(30).max(200),
});

const mcp = createMcpHandler((server) => {
  server.registerTool(
    'echoVisit',
    {
      title: 'Echo visit',
      description:
        'Save a blood pressure reading. Call this when the user gives a BP value or asks to save it. bp_sys is systolic (upper), bp_dia is diastolic (lower).',
      inputSchema: EchoVisitInput,
    },
    async (args) => {
      const t0 = Date.now();
      const parsed = EchoVisitInput.safeParse(args);
      if (!parsed.success) {
        console.log('[mcp] echoVisit INVALID', JSON.stringify(args));
        return { isError: true, content: [{ type: 'text', text: 'invalid input' }] };
      }
      console.log(
        `[mcp] echoVisit bp_sys=${parsed.data.bp_sys} bp_dia=${parsed.data.bp_dia} ms=${Date.now() - t0}`,
      );
      return {
        content: [{ type: 'text', text: JSON.stringify({ received: true, ...parsed.data }) }],
      };
    },
  );
});

function authorized(req: Request): boolean {
  const secret = process.env.MCP_SHARED_SECRET;
  if (!secret) return false;
  const h = req.headers.get('authorization') ?? '';
  const got = Buffer.from(h.startsWith('Bearer ') ? h.slice(7) : '');
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function handler(req: Request): Promise<Response> {
  // Log header NAMES + method only (never values).
  console.log(`[mcp] ${req.method} headers=${[...req.headers.keys()].join(',')}`);
  if (!authorized(req)) {
    console.log('[mcp] 401 unauthorized');
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return mcp(req);
}

export { handler as GET, handler as POST, handler as DELETE };
