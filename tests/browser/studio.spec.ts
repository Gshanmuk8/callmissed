import { test, expect, type Page } from '@playwright/test';
const connected = {
  provider: 'Test fixture',
  chat: { ready: true, label: 'Ready' },
  images: { ready: true, label: 'Ready' },
  voice: { ready: true, label: 'Ready' },
};
async function mode(page: Page, label: string) {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: new RegExp(label) })
    .click();
}
test('honest disconnected state and accessible settings', async ({ page }) => {
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        provider: 'Not connected',
        chat: { ready: false, label: 'Connection needed' },
        images: { ready: false, label: 'Connection needed' },
        voice: { ready: false, label: 'Connection needed' },
      },
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Think out loud.' })).toBeVisible();
  await page.getByRole('button', { name: 'Start a conversation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Pending', { exact: true })).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('navigation, original studies, prompt selection and no overflow', async ({ page }) => {
  await page.goto('/');
  await mode(page, 'Image');
  await page.getByRole('button', { name: /Somewhere, slower/ }).click();
  await expect(page.getByLabel('What do you want to see?')).toHaveValue(/terracotta/);
  await page.getByRole('button', { name: /Cinematic/ }).click();
  await expect(page.getByRole('button', { name: /Cinematic/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('streamed chat persists, search finds it, fresh start clears it', async ({ page }) => {
  await page.route('**/api/config', (r) => r.fulfill({ json: connected }));
  await page.route('**/api/chat', (r) =>
    r.fulfill({
      contentType: 'text/event-stream',
      body: 'data: {"type":"delta","text":"Here is a **useful idea**."}\n\ndata: {"type":"done"}\n\n',
    }),
  );
  await page.goto('/');
  await mode(page, 'Chat');
  await page.getByLabel('Your message').fill('A cedar studio');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('useful idea', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await page.reload();
  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Search your sessions' }).fill('cedar');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /A cedar studio/ })
    .click();
  await expect(page.getByText('useful idea', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fresh start' }).click();
  await expect(page.getByText('useful idea', { exact: true })).not.toBeVisible();
});
test('provider failure preserves the prompt and never fakes an answer', async ({ page }) => {
  await page.route('**/api/config', (r) => r.fulfill({ json: connected }));
  await page.route('**/api/chat', (r) =>
    r.fulfill({
      status: 429,
      json: { code: 'QUOTA', message: 'Daily allowance reached. Try after reset.' },
    }),
  );
  await page.goto('/');
  await mode(page, 'Chat');
  await page.getByLabel('Your message').fill('Keep my words');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('alert')).toContainText('Daily allowance');
  await expect(page.getByLabel('Your message')).toHaveValue('Keep my words');
  await expect(page.getByLabel('Conversation')).not.toBeVisible();
});
test('image generation and file download use the actual returned image', async ({ page }) => {
  await page.route('**/api/config', (r) => r.fulfill({ json: connected }));
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  await page.route('**/api/images', (r) => r.fulfill({ json: { dataUrl, mime: 'image/png' } }));
  await page.goto('/');
  await mode(page, 'Image');
  await page.getByLabel('What do you want to see?').fill('A red test pixel');
  await page.getByRole('button', { name: 'Make it real' }).click();
  await expect(page.getByRole('img', { name: 'A red test pixel', exact: true })).toHaveAttribute(
    'src',
    dataUrl,
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
});
test('keyboard controls and dialog focus stay in the active dialog', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox', { name: 'Search your sessions' })).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
