import { expect, test, type Locator, type Page } from '@playwright/test';
import { completeTask } from './helpers';

const startTasks = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try as student' }).click();
  await page.getByRole('button', { name: 'No thanks, just try it' }).click();
  await expect(page).toHaveURL(/\/Q1$/);
};

const answerQ1 = async (page: Page) => {
  await page.getByRole('radiogroup').nth(0).getByRole('radio').first().check({ force: true });
  await page.getByRole('radiogroup').nth(1).getByRole('radio').first().check({ force: true });
  await page.getByRole('button', { name: 'Continue →' }).click();
};

const dragBar = async (page: Page, slider: Locator) => {
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  await expect(slider).toHaveAttribute('aria-valuenow', '20');
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 10 });
  await expect(slider).toHaveAttribute('aria-valuenow', '50');
  await page.mouse.move(box.x + box.width * 0.8, y + 120, { steps: 10 });
  await expect(slider).toHaveAttribute('aria-valuenow', '80');
  await page.mouse.move(box.x + box.width + 200, y, { steps: 5 });
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  await page.mouse.up();
  await page.mouse.move(box.x + box.width * 0.1, y, { steps: 5 });
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
};

/** A page shorter than the window does not scroll, and its footer sits on the bottom edge. */
const expectAtBottom = async (page: Page, footer: Locator) => {
  await expect(footer).toBeVisible();
  const box = (await footer.boundingBox())!;
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    client: document.documentElement.clientHeight,
  }));
  expect(scroll).toBe(client);
  expect(client - (box.y + box.height)).toBeLessThanOrEqual(24);
};

const openTeacher = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try as teacher' }).click();
  await expect(page).toHaveURL(/\/t\/lessons/);
  await expect(page.locator('.card').first()).toBeVisible();
};

test('the first-answer bar follows a drag, past the end of the bar too', async ({ page }) => {
  await startTasks(page);
  await answerQ1(page);
  await dragBar(page, page.getByRole('slider'));
});

test('the final-answer bar drags on both Keep and Revise', async ({ page }) => {
  await startTasks(page);
  await answerQ1(page);
  await page.getByRole('slider').focus();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: 'Lock in answer' }).click();
  await page.getByRole('button', { name: 'Keep my answer' }).click();
  await dragBar(page, page.getByRole('slider'));
  await page.getByRole('button', { name: /Revise answer/ }).click();
  await dragBar(page, page.getByRole('slider'));
});

test('Q2 cards reorder by drag and by the buttons', async ({ page }) => {
  await startTasks(page);
  await completeTask(page, 'Q1');
  await expect(page).toHaveURL(/\/Q2$/);
  const rows = page.locator('li.rank');
  await expect(rows).toHaveCount(4);
  const lastCard = await rows.nth(3).locator('.rank-card > span').first().innerText();

  const last = (await rows.nth(3).boundingBox())!;
  const first = (await rows.nth(0).boundingBox())!;
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
  await page.mouse.down();
  const bottomRank = (await rows.nth(3).locator('.k').boundingBox())!;
  await page.mouse.move(last.x + last.width / 2, first.y, { steps: 20 });
  // Only the card moves: the rank numbers stay where they are during the drag.
  expect((await rows.nth(3).locator('.k').boundingBox())!.y).toBe(bottomRank.y);
  await expect(rows.nth(3).locator('.k')).toHaveText('4');
  await page.mouse.up();
  await expect(rows.nth(0)).toContainText(lastCard);

  // dnd-kit swallows a click that lands just after a drop; no person is that quick.
  await page.waitForTimeout(200);
  await rows.nth(0).getByRole('button', { name: /down$/ }).click();
  await expect(rows.nth(1)).toContainText(lastCard);
});

test('the student footer stays at the bottom on a short page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await startTasks(page);
  await completeTask(page, 'Q1');
  await expect(page).toHaveURL(/\/Q2$/);
  await expectAtBottom(page, page.locator('.legal-foot'));
});

test('the consent footer stays at the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try as student' }).click();
  await expect(page.getByRole('heading', { name: 'Taking part in research' })).toBeVisible();
  await expectAtBottom(page, page.locator('.legal-foot'));
});

test('the teacher footer stays at the bottom with no extra height', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openTeacher(page);
  await expectAtBottom(page, page.locator('.legal-foot'));
});

test('the task editor has the footer at the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  const lessons = page.waitForResponse((response) => response.url().endsWith('/api/v1/lessons'));
  await openTeacher(page);
  const lessonId = ((await (await lessons).json()) as { lessons: { id: string }[] }).lessons[0]!.id;
  await page.goto(`/t/lessons/${lessonId}/tasks/Q1`);
  await expect(page.locator('.ed')).toBeVisible();
  await expectAtBottom(page, page.locator('.legal-foot'));
});

test('a finished student starts a new run, keeps the old one, and can always go home', async ({ page }) => {
  await startTasks(page);
  for (const slot of ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']) await completeTask(page, slot);
  await expect(page).toHaveURL(/results/);
  await expect(page.getByText('PARTICIPANT CODE')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 1400 });
  await expectAtBottom(page, page.locator('.legal-foot'));
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Try LOGINA' })).toBeVisible();
  await page.getByRole('button', { name: 'Try as student' }).click();
  await expect(page).toHaveURL(/\/Q1$/);
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.getByRole('link', { name: 'My runs' }).click();
  await expect(page.getByRole('link', { name: /Run 1/ })).toBeVisible();
  await expectAtBottom(page, page.locator('.legal-foot'));
  await page.getByRole('link', { name: /Run 1/ }).click();
  await expect(page).toHaveURL(/_run1\/results/);
  await expect(page.getByRole('cell', { name: 'Q5', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a new run' })).toHaveCount(0);
});

test('every bar starts at 50 with one knob, and Reset run goes back to Q1', async ({ page }) => {
  await startTasks(page);
  await completeTask(page, 'Q1');
  await expect(page).toHaveURL(/\/Q2$/);
  await page.getByRole('button', { name: 'Continue →' }).click();
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('button', { name: 'Lock in answer' }).click();
  await page.getByRole('button', { name: 'Keep my answer' }).click();
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
  await expect(page.locator('.knob')).toHaveCount(1);

  await page.getByRole('button', { name: 'Reset run' }).click();
  const popup = page.getByRole('dialog', { name: 'Start over?' });
  await expect(popup).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset run' }).click();
  await popup.getByRole('button', { name: 'Cancel' }).click();
  await expect(popup).toHaveCount(0);
  await expect(page).toHaveURL(/\/Q2$/);
  await page.getByRole('button', { name: 'Reset run' }).click();
  await popup.getByRole('button', { name: 'Yes, start over' }).click();
  await expect(page).toHaveURL(/\/Q1$/);
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeDisabled();
});

test('the header menu is for phones: desktop shows its actions, a phone folds them away', async ({ page }) => {
  await startTasks(page);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'My runs' })).toBeVisible();
  await expect(page).toHaveTitle('Q1 Statement · Student · LOGINA');

  await page.setViewportSize({ width: 375, height: 760 });
  await expect(page.getByRole('link', { name: 'My runs' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Reset run' })).toBeHidden();
  const height = await page.locator('.stu-phone').evaluate((header) => header.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(60);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: 'Reset run' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Reset run' })).toBeHidden();
});

test('the Continue bar stays in view on a long page and says why it waits', async ({ page }) => {
  await startTasks(page);
  await expect(page.getByText('Choose a statement to continue.')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeInViewport();
});

test('progress shows only what was submitted, even when a task is opened by URL', async ({ page }) => {
  await startTasks(page);
  await page.goto(page.url().replace(/Q1$/, 'Q3'));
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeVisible();
  await expect(page.locator('.tasks > li.done')).toHaveCount(0);
});

test('the teacher phone header is short and opens a menu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await openTeacher(page);
  const height = await page.locator('.side').evaluate((header) => header.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(80);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: /Open student view/ })).toBeVisible();
});

test('the teacher sidebar cannot be collapsed', async ({ page }) => {
  await openTeacher(page);
  await expect(page.getByRole('button', { name: /collapse/i })).toHaveCount(0);
});

test('the tab has the logo', async ({ page, request }) => {
  await page.goto('/');
  for (const href of await page.locator('link[rel="icon"]').evaluateAll((links) => links.map((l) => l.getAttribute('href')!))) {
    expect((await request.get(href)).status()).toBe(200);
  }
  await expect(page.locator('link[rel="icon"]')).toHaveCount(2);
});
