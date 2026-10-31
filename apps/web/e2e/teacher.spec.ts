import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoSideScroll } from './helpers';

const openDemoMenu = async (page: Page) => page.getByRole('button', { name: 'Demo menu' }).click();

test('a new teacher sees the ready Lesson 8 set', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try as teacher' }).click();
  await expect(page).toHaveURL(/\/t\/lessons/);
  await expect(page.locator('.card').first()).toBeVisible();
  await expectAccessible(page, 'teacher home');
  await expectNoSideScroll(page);
});

test('the full teacher path, from the sample to tracking', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/t/lessons/new');
  await page.getByRole('button', { name: 'Use sample material' }).click();
  await page.getByLabel(/Source title/).fill('Geography 12, Lesson 8');
  await page.getByLabel(/Reasoning goal/).fill('Students judge whether a statement is fully supported by evidence.');
  await page.getByLabel(/Lesson set title/).fill('Labor and Employment');
  await page.getByLabel(/Subject/).fill('Geography');
  await page.getByLabel(/Topic/).fill('Labor');
  await expectAccessible(page, 'T1');
  await page.getByRole('button', { name: 'Analyze material' }).click();

  await expect(page).toHaveURL(/\/clarify/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Clarify material' })).toBeVisible();
  await expectAccessible(page, 'T3');
  const keepOpen = page.getByRole('button', { name: 'Keep open (bounded)' });
  const openPoints = await keepOpen.count();
  await keepOpen.first().click();
  await page.getByLabel('What the lesson may say').fill('Shares only');
  await page.getByLabel('Why it stays open').fill('The table has no totals');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(keepOpen).toHaveCount(openPoints - 1);
  await page.getByRole('button', { name: 'Use selected suggestion' }).first().click();
  await expect(page.getByRole('link', { name: 'Continue: Source review →' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue: Source review →' }).click();

  await expect(page.getByRole('heading', { name: 'Source review' })).toBeVisible();
  await expectAccessible(page, 'T5');
  await page.getByRole('button', { name: 'Approve source (Approval 1)' }).click();

  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByText('Q4 needs your decision')).toBeVisible({ timeout: 60_000 });
  await expectAccessible(page, 'T6');
  await page.getByRole('button', { name: 'Regenerate Q4 with this choice' }).click();
  await expect(page.getByRole('link', { name: /Q4 · Counterargument template/ })).toBeVisible({ timeout: 60_000 });

  await page.getByRole('link', { name: /Q1 · Statement \+ evidence/ }).click();
  await expect(page.getByText('STRUCTURE CHECKS')).toBeVisible();
  await expectAccessible(page, 'T7');
  await page.getByRole('button', { name: 'Quick edit A4' }).click();
  await page.locator('#edit-A4').fill('The share of workers in services decreased, giving way to industry and construction.');
  await page.getByRole('button', { name: 'Save and recheck' }).click();
  await expect(page.getByText('Draft v4')).toBeVisible({ timeout: 60_000 });

  await page.getByRole('link', { name: /Go to Approval 2/ }).click();
  await expect(page.getByRole('heading', { name: 'Task approval' })).toBeVisible();
  await expectAccessible(page, 'T12');

  await page.getByLabel('Accept warning, give a reason').fill('Fits this class');
  await page.getByRole('button', { name: 'Save decision' }).click();

  await page.getByRole('link', { name: 'Open to fix' }).click();
  await expect(page).toHaveURL(new RegExp('tasks/Q4$'));
  await page.getByRole('button', { name: 'Edit TN2' }).click();
  await page.locator('#prompt-TN2').fill('What else would you need to know before saying that agriculture is weaker?');
  await page.getByRole('button', { name: 'Save and recheck' }).click();
  await expect(page.getByText('Draft v4')).toBeVisible({ timeout: 60_000 });

  await page.getByRole('link', { name: /Go to Approval 2/ }).click();
  for (const slot of ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']) {
    await page.getByRole('button', { name: `Review ${slot}` }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: `Approve ${slot}` }).click();
    await expect(page.getByRole('button', { name: `Review ${slot}` })).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Assign · 5/5' }).click();
  await expect(page.getByRole('heading', { name: 'Assign', exact: true })).toBeVisible();
  await expectAccessible(page, 'T13');
  await page.getByRole('button', { name: 'Assign', exact: true }).click();

  await expect(page).toHaveURL(/\/t\/assignments\//);
  await expect(page.getByText('0 people started, 0 finished')).toBeVisible();
  await page.getByRole('button', { name: 'Demo menu' }).click();
  await page.getByRole('button', { name: 'Simulate class' }).click();
  await expect(page.getByText('7 people started, 7 finished')).toBeVisible({ timeout: 60_000 });
});

test('tracking after Jump to T14 shows the class and a trace', async ({ page }) => {
  await page.goto('/t/lessons');
  await openDemoMenu(page);
  await page.getByRole('button', { name: /T14/ }).click();
  await expect(page.getByRole('button', { name: /T14/ })).toBeHidden({ timeout: 30_000 });
  await page.locator('a.card').first().click();
  await expect(page.getByText('8 people started, 8 finished')).toBeVisible();
  await expectAccessible(page, 'T14');
  await page.getByRole('link', { name: 'View trace' }).first().click();
  await expect(page.getByText('1. FIRST ANSWER')).toBeVisible();
  await expectAccessible(page, 'T15');
});

test('two browsers never see each other', async ({ browser }) => {
  const [one, two] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [first, second] = await Promise.all([one.newPage(), two.newPage()]);
  await first.goto('/t/lessons');
  await first.locator('a.card').first().waitFor();
  const href = await first.locator('a.card').first().getAttribute('href');
  await second.goto('/t/lessons');
  await second.locator('a.card').first().waitFor();
  expect(await second.locator('a.card').first().getAttribute('href')).not.toBe(href);
  await one.close();
  await two.close();
});
