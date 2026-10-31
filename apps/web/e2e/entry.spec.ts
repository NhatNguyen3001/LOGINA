import { expect, test } from '@playwright/test';

const SCREENS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 650 },
  { width: 1920, height: 1080 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];

for (const viewport of SCREENS) {
  test(`the first screen does not scroll at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeInViewport();
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      client: document.documentElement.clientHeight,
    }));
    expect(scroll).toBe(client);
  });
}

test('a device in dark mode still gets the light theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const background = await page.evaluate(() => getComputedStyle(document.querySelector('.login-brand')!).backgroundColor);
  expect(background).toBe('rgb(255, 255, 255)');
});
