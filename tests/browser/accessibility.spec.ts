import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('main workspaces have no serious accessibility violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const mode of ['Voice', 'Chat', 'Image']) {
    const menu = page.getByRole('button', { name: 'Open navigation' });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: new RegExp(mode) })
      .click();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations
        .filter((v) => ['critical', 'serious'].includes(v.impact || ''))
        .map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
    ).toEqual([]);
  }
});
