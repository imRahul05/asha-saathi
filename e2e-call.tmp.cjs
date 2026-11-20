// One-off E2E: a real call with a fake microphone that plays a recorded Hindi conversation.
const { chromium } = require('/Users/amananku/.npm/_npx/9833c18b2d85bc59/node_modules/playwright');
(async () => {
  const [wav, base, seconds] = [process.argv[2], process.argv[3], Number(process.argv[4] || 90)];
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${wav}%noloop`, '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`);
  await page.getByRole('button', { name: /Continue as demo ASHA/ }).click();
  await page.waitForURL('**/app');
  await page.getByRole('button', { name: /Start the call/ }).click({ force: true });
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < seconds * 1000) {
    await page.waitForTimeout(4000);
    const txt = await page.locator('[aria-label="Conversation"]').innerText().catch(() => '');
    if (txt !== last) { console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${txt.replace(/\n+/g, ' | ').slice(-330)}`); last = txt; }
  }
  const orb = await page.locator('p[aria-live="polite"]').first().innerText().catch(() => '');
  const alerts = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
  const detail = await page.locator('[aria-label="Visit details"]').innerText().catch(() => '');
  console.log('ORB: ' + orb + ' | BANNERS: ' + JSON.stringify(alerts.filter((a) => a !== 'ASHA Saathi')));
  console.log('VISIT PANEL: ' + detail.replace(/\n+/g, ' | ').slice(0, 1500));
  await page.getByRole('button', { name: /End call/ }).click().catch(() => {});
  await browser.close();
})().catch((e) => { console.error('E2E FAILED', e); process.exit(1); });
