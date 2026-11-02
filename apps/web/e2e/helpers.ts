import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Fills a Q1 to Q5 task with the first valid answer, then locks it and keeps it. */
export async function completeTask(page: Page, slot: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/${slot}$`));
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeVisible();
  if (slot === 'Q1') {
    await page.getByRole('radiogroup').nth(0).getByRole('radio').first().check({ force: true });
    await page.getByRole('radiogroup').nth(1).getByRole('radio').first().check({ force: true });
  }
  if (slot === 'Q3') {
    for (const name of ['Choose one path', 'What does this choice give up?', 'Why does that cost come with this choice?']) {
      await page.getByRole('radiogroup', { name }).getByRole('radio').first().check({ force: true });
    }
  }
  if (slot === 'Q4') {
    for (let i = 0; i < (await page.locator('.blank').count()); i += 1) {
      await page.locator('.word-card').first().click();
      await page.locator('.blank:not(.full)').first().click();
    }
  }
  if (slot === 'Q5') {
    const inputs = page.locator('.starter input');
    for (let i = 0; i < (await inputs.count()); i += 1) await inputs.nth(i).fill('vocational training');
  }
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('slider').focus();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: 'Lock in answer' }).click();
  await page.getByRole('button', { name: `Submit ${slot}` }).click();
}

export async function expectAccessible(page: Page, name: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${name}: ${v.id} ${v.nodes.length} ${v.nodes[0]?.html.slice(0, 120)}`)).toEqual([]);
}

export async function expectNoSideScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
