import { findRestrictedKeys } from '@logina/contracts';
import { expect, test } from '@playwright/test';
import { completeTask, expectAccessible, expectNoSideScroll } from './helpers';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

test('a judge goes from the entry page through consent, five tasks and results', async ({ page }) => {
  const leaks: string[] = [];
  page.on('response', async (response) => {
    if (!response.url().includes('/api/v1/') || !response.ok()) return;
    const body = await response.json().catch(() => null);
    if (body) leaks.push(...findRestrictedKeys(body, 'student').map((key) => `${response.url()}: ${key}`));
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Try LOGINA' })).toBeVisible();
  await expectAccessible(page, 'P0');
  await page.getByRole('button', { name: 'Try as student' }).click();

  await expect(page.getByRole('heading', { name: 'Taking part in research' })).toBeVisible();
  await expectAccessible(page, 'consent');
  await page.getByRole('button', { name: 'No thanks, just try it' }).click();

  await expect(page).toHaveURL(/\/s\/attempts\/.+\/Q1/);
  await expectAccessible(page, 'S1');
  for (const slot of SLOTS) await completeTask(page, slot);

  await expect(page).toHaveURL(/results/);
  await expect(page.getByRole('cell', { name: 'Q5', exact: true })).toBeVisible();
  await expect(page.getByText('PARTICIPANT CODE')).toHaveCount(0);
  await expectAccessible(page, 'S8');
  expect(leaks).toEqual([]);
});

test('a reload after locking shows the same answer and prompt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try as student' }).click();
  await page.getByRole('button', { name: 'No thanks, just try it' }).click();
  await page.getByRole('radiogroup').nth(0).getByRole('radio').first().check({ force: true });
  await page.getByRole('radiogroup').nth(1).getByRole('radio').first().check({ force: true });
  await page.getByRole('button', { name: 'Continue →' }).click();
  await page.getByRole('slider').focus();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: 'Lock in answer' }).click();
  const prompt = await page.locator('.say').textContent();
  await page.reload();
  await expect(page.locator('.say')).toHaveText(prompt!);
});

test('the student screens fit a phone with no sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expectNoSideScroll(page);
  await page.getByRole('button', { name: 'Try as student' }).click();
  await page.getByRole('button', { name: 'No thanks, just try it' }).click();
  await expect(page).toHaveURL(/\/Q1/);
  await page.getByRole('radiogroup').nth(0).waitFor();
  await expectNoSideScroll(page);
});
