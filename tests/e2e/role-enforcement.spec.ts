import { test, expect } from '@playwright/test';

test.describe('Role Enforcement', () => {
  test('COUNSEL cannot access DSG queue page', async ({ page }) => {
    // Log in as counsel — lands on /my-work
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('counsel@ag.go.ke');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /access workspace/i }).click();
    await expect(page).toHaveURL(/.*my-work/);

    // Attempt to access queue — should be blocked
    await page.goto('/queue');
    
    // Counsel should NOT see /queue — redirected away
    await expect(page).not.toHaveURL(/.*\/queue$/);
    await page.screenshot({ path: 'test-results/roles/counsel-queue-blocked.png' });
  });

  test('DSG can access queue page', async ({ page }) => {
    // Log in as DSG — lands on /dashboard
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('dsg@ag.go.ke');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /access workspace/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Navigate to queue
    await page.goto('/queue');
    
    // Verify DSG has access
    await expect(page).toHaveURL(/.*\/queue/);
    await expect(page.getByRole('heading', { name: /Allocation Queue/i, level: 1 })).toBeVisible();
    await page.screenshot({ path: 'test-results/roles/dsg-queue-allowed.png' });
  });
});
