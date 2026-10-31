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
    const groups = page.locator('fieldset');
    for (let i = 0; i < (await groups.count()); i += 1) await groups.nth(i).getByRole('radio').first().check({ force: true });
    await page.getByRole('radiogroup').getByRole('radio').first().check({ force: true });
  }
  if (slot === 'Q4') {
    await page.getByRole('radiogroup').getByRole('radio').first().check({ force: true });
    const selects = page.locator('select');
    for (let i = 0; i < (await selects.count()); i += 1) await selects.nth(i).selectOption({ index: 1 });
  }
  if (slot === 'Q5') {
    await page.locator('#proposal').fill('Offer vocational training in the district.');
    await page.locator('#reason').fill('The share of workers in services is rising.');
  }
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('slider').focus();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: 'Lock in answer' }).click();
  await page.getByRole('button', { name: 'Keep my answer' }).click();
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
