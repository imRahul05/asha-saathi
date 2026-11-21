// MCP tool server for the voice agent. Agora's managed LLM calls these tools over streamable HTTP.
// Auth: Bearer secret (MCP_SHARED_SECRET). Each call is scoped to one ASHA and one call (session) by headers
// that our own agent-start route put into mcp_servers[].headers.
import { createMcpHandler } from 'mcp-handler';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { firstAsha } from '@/lib/db/repo';
import { getNotifier } from '@/lib/notify';
import { executeTool, TOOLS, type ToolContext } from '@/lib/tools';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.MCP_SHARED_SECRET;
  if (!secret) return false;
  const h = req.headers.get('authorization') ?? '';
  const got = Buffer.from(h.startsWith('Bearer ') ? h.slice(7) : '');
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function buildContext(req: Request): Promise<ToolContext | null> {
  const db = getDb();
  const headerAsha = req.headers.get('x-asha-id');
  // The header is set by our own start route (behind the shared secret) from the signed session, so it is trusted without another database round trip:
  // every tool query is scoped to this id, and an id that does not exist simply finds nothing. Only without a header (local checks) fall back to the first ASHA.
  const ashaId = headerAsha && UUID.test(headerAsha) ? headerAsha : (await firstAsha(db))?.id;
  if (!ashaId) return null;
  return {
    db,
    ashaId,
    sessionId: (req.headers.get('x-session') ?? '').slice(0, 120) || null,
    turnId: randomUUID(),
    notifier: getNotifier(),
    now: () => new Date(),
  };
}

async function handler(req: Request): Promise<Response> {
  if (!authorized(req)) {
    console.log('[mcp] 401 unauthorized');
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  let ctx: ToolContext | null;
  try {
    ctx = await buildContext(req);
  } catch (e) {
    console.error('[mcp] database unavailable', e);
    return new Response(JSON.stringify({ error: 'database unavailable' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
  if (!ctx) {
    return new Response(JSON.stringify({ error: 'no ASHA is set up. Run pnpm db:seed or add one.' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
  const context = ctx;

  const mcp = createMcpHandler((server) => {
    // Our tools are defined generically (zod input, ToolResult output), so register through a loosely typed alias.
    const register = server.registerTool.bind(server) as unknown as (
      name: string,
      config: { description: string; inputSchema: unknown },
      cb: (args: unknown) => Promise<{ content: { type: 'text'; text: string }[] }>,
    ) => void;
    for (const tool of TOOLS) {
      register(tool.name, { description: tool.description, inputSchema: tool.input }, async (args) => {
        const result = await executeTool(tool as never, args, context);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      });
    }
  });
  return mcp(req);
}

export { handler as GET, handler as POST, handler as DELETE };
