import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results/visual', { recursive: true });
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'msedge' : undefined,
});
try {
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 1050 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    for (const mode of ['Voice', 'Chat', 'Image']) {
      const menu = page.getByRole('button', { name: 'Open navigation' });
      if (await menu.isVisible()) await menu.click();
      await page
        .getByRole('navigation')
        .getByRole('button', { name: new RegExp(mode) })
        .click();
      await page.screenshot({
        path: `test-results/visual/${name}-${mode.toLowerCase()}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
    await page.close();
  }
} finally {
  await browser.close();
}
