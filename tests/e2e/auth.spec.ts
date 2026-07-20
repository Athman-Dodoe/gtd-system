import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('User can log in with valid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('counsel@ag.go.ke');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /access workspace/i }).click();

    // After login the form does router.push('/') then the middleware redirects
    // to /my-work (COUNSEL) or /dashboard (DSG). Wait for any non-login URL.
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 20000 });
    await expect(page).toHaveURL(/.*(dashboard|my-work)/);
    await page.screenshot({ path: 'test-results/auth/login-success.png' });
  });

  test('Shows error message on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('wrong@ag.go.ke');
    await page.locator('#password').fill('wrongpass');
    await page.getByRole('button', { name: /access workspace/i }).click();

    // The app shows: "Invalid credentials. Please try again."
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await page.screenshot({ path: 'test-results/auth/login-failure.png' });
  });

  test('New user forced to reset password', async ({ page }) => {
    // newuser@ag.go.ke has mustChangePassword = true
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('newuser@ag.go.ke');
    await page.locator('#password').fill('temp123');
    await page.getByRole('button', { name: /access workspace/i }).click();

    // Middleware (middleware.ts line 25-27) redirects mustChangePassword users
    // to /login/change-password
    await expect(page).toHaveURL(/.*change-password/);
    await page.screenshot({ path: 'test-results/auth/force-reset-redirected.png' });
  });
});
