def edit(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:70], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)

edit('app/api/invite-agent/route.ts', [
 ("    const baseUrl = process.env.PUBLIC_BASE_URL ?? `https://${request.headers.get('host')}`;",
  """    const baseUrl = process.env.PUBLIC_BASE_URL ?? `https://${request.headers.get('host')}`;
    // Agora's cloud calls our tool server over the internet, so it rejects localhost and private addresses. Say so plainly instead of passing on Agora's raw error.
    if (/^https?:\\/\\/(localhost|127\\.|0\\.0\\.0\\.0|\\[::1\\]|10\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.)/i.test(baseUrl)) {
      return NextResponse.json(
        {
          error: 'LOCAL_URL_NOT_REACHABLE',
          message:
            'The voice agent cannot reach a localhost address. Set PUBLIC_BASE_URL in .env.local to a public URL (your deployed site, or a tunnel such as `cloudflared tunnel --url http://localhost:3000`) and restart. See README: Local testing.',
        },
        { status: 400 },
      );
    }"""),
])

edit('components/LandingPage.tsx', [
 ("              setAgentJoinError(`Agent start failed (HTTP ${res.status}). ${body.slice(0, 240)}`);",
  "              let friendly: string | null = null;\n              try {\n                const parsedBody = JSON.parse(body) as { error?: string; message?: string };\n                if (parsedBody.error === 'LOCAL_URL_NOT_REACHABLE') friendly = parsedBody.message ?? null;\n              } catch { /* not JSON: show the raw text below */ }\n              setAgentJoinError(friendly ?? `Agent start failed (HTTP ${res.status}). ${body.slice(0, 240)}`);"),
])

edit('scripts/setup-local.ts', [
 ("console.log('\\nImportant: Agora cannot reach localhost. To test the voice agent from your machine, set PUBLIC_BASE_URL to a public URL');\nconsole.log('(a tunnel such as `cloudflared tunnel --url http://localhost:3000`, or your deployed URL). Sign-in and the screens work without it.');",
  "console.log('\\nImportant: Agora cannot reach localhost (the call fails with \"URL host localhost is blocked\"). To test the voice agent from your machine, set PUBLIC_BASE_URL');\nconsole.log('to a public URL: your deployed site (then MCP_SHARED_SECRET and DATABASE_URL here must match that deployment), or a tunnel such as `cloudflared tunnel --url http://localhost:3000`.');\nif (!has('PUBLIC_BASE_URL')) console.log('  -> PUBLIC_BASE_URL is NOT set in your env files yet.');\nconsole.log('Sign-in and the screens work without it.');"),
])

edit('README.md', [
 ("## Voices\n", """## Local testing

Sign-in, the screens and the tests work on `localhost`. The **voice agent does not**: Agora's cloud calls your tool server over the internet and rejects `localhost` ("URL host localhost is blocked"). To test a call from your machine set `PUBLIC_BASE_URL` in `.env.local` to either:

- your deployed site, e.g. `https://asha-saathi-mocha.vercel.app`. Tool calls then run on that deployment, so your local `MCP_SHARED_SECRET` and `DATABASE_URL` must match its values; or
- a tunnel to your local server (`cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`), which also tests your local tool code.

Restart `pnpm dev` after changing it. The app now shows this advice instead of the raw Agora error.

## Voices
"""),
])
print('ok')
