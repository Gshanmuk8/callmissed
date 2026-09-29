import { test, expect } from '@playwright/test';
const connected = {
  provider: 'Fixture',
  chat: { ready: true, label: 'Ready' },
  images: { ready: true, label: 'Ready' },
  voice: { ready: true, label: 'Ready' },
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/config', (r) => r.fulfill({ json: connected }));
  await page.addInitScript(() => {
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const streams: MediaStream[] = [];
    (window as unknown as { testStreams: MediaStream[] }).testStreams = streams;
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await get(c);
      streams.push(s);
      return s;
    };
  });
});
test('records canonical WAV, sends context, and releases all microphone tracks', async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route('**/api/voice', async (r) => {
    requests.push(
      new TextDecoder('latin1').decode(r.request().postDataBuffer() || new Uint8Array()),
    );
    await r.fulfill({
      json: {
        transcript: 'My idea is Cedar.',
        answer: 'Let’s explore Cedar.',
        audioUrl: null,
        audioError: 'Speech unavailable in this test fixture.',
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a conversation' }).click();
  await expect(page.getByRole('heading', { name: 'I’m listening. Take your time.' })).toBeVisible();
  await expect(page.getByText(/01 \/ 15 seconds/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish & send' }).click();
  await expect(page.getByText('Let’s explore Cedar.', { exact: true })).toBeVisible();
  expect(requests[0]).toContain('RIFF');
  expect(requests[0]).toContain('WAVE');
  expect(
    await page.evaluate(() =>
      (window as unknown as { testStreams: MediaStream[] }).testStreams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Record next thought' }).click();
  await expect(page.getByText(/01 \/ 15 seconds/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish & send' }).click();
  await expect(page.getByText('Let’s explore Cedar.', { exact: true })).toHaveCount(2);
  expect(requests[1]).toContain('Cedar');
});
test('discard and mode change stop capture without calling inference', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/voice', (r) => {
    calls++;
    return r.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a conversation' }).click();
  await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('button', { name: 'Start a conversation' })).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as unknown as { testStreams: MediaStream[] }).testStreams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    ),
  ).toBe(true);
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Start a conversation' }).click();
  await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').getByRole('button', { name: /Chat/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { testStreams: MediaStream[] }).testStreams.every((s) =>
          s.getTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    )
    .toBe(true);
  expect(calls).toBe(0);
});
test('late microphone permission is cleaned up after cancellation', async ({ page }) => {
  await page.addInitScript(() => {
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const stream = await get(c);
      await new Promise<void>((resolve) => {
        (window as unknown as { releaseMic: () => void }).releaseMic = resolve;
      });
      return stream;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a conversation' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for your microphone…' })).toBeVisible();
  await page.waitForFunction(
    () => typeof (window as unknown as { releaseMic?: () => void }).releaseMic === 'function',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => (window as unknown as { releaseMic: () => void }).releaseMic());
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { testStreams: MediaStream[] }).testStreams.every((s) =>
          s.getTracks().every((t) => t.readyState === 'ended'),
        ),
      ),
    )
    .toBe(true);
  await expect(page.getByRole('heading', { name: 'Ready to listen.' })).toBeVisible();
});
