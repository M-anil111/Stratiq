import { test, expect } from '@playwright/test'

const protectedRoutes = ['/dashboard', '/clients', '/tasks', '/invoices']

for (const route of protectedRoutes) {
  test(`unauthenticated visit to ${route} redirects to /login`, async ({ page }) => {
    await page.goto(route)
    await page.waitForURL('**/login**')
    expect(new URL(page.url()).pathname).toBe('/login')
  })
}

test('login page renders email, password and submit button', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByPlaceholder('you@agency.com')).toBeVisible()
  await expect(page.getByPlaceholder('••••••••')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
})

test('forgot-password page is public and renders the reset form', async ({ page }) => {
  const response = await page.goto('/forgot-password')
  expect(response).not.toBeNull()
  expect(response!.status()).toBeLessThan(400)
  // Middleware treats /forgot-password as a public route, so anonymous
  // visitors get the reset form directly (no redirect to /login).
  expect(new URL(page.url()).pathname).toBe('/forgot-password')
  await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible()
})
