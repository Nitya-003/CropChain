import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login as a Farmer successfully', async ({ page }) => {
    // Mock the login API
    await page.route('**/auth/login', async route => {
      const json = {
        success: true,
        data: {
          token: 'fake-jwt-token',
          user: {
            id: 'farmer-123',
            name: 'Test Farmer',
            email: 'farmer@test.com',
            role: 'FARMER',
            balance: 1000
          }
        }
      };
      await route.fulfill({ json });
    });

    // Mock the session refresh API that runs on load
    await page.route('**/auth/refresh', async route => {
      await route.fulfill({ status: 401 });
    });

    await page.goto('/login?from=/farmer');

    // Fill in credentials
    await page.fill('input[type="email"]', 'farmer@test.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Submit form
    await page.locator('button[type="submit"]').click();

    // Should redirect to farmer dashboard
    await expect(page).toHaveURL(/.*\/farmer/);
    await expect(page.getByText('Test Farmer').first()).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    // Mock the login API to fail
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({ 
        status: 401,
        json: { success: false, message: 'Invalid credentials' } 
      });
    });

    // Mock session refresh
    await page.route('**/api/auth/refresh', async route => {
      await route.fulfill({ status: 401 });
    });

    await page.goto('/login');

    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Invalid credentials').first()).toBeVisible();
  });
});
