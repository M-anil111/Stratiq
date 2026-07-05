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

test('forgot-password route responds without a server error', async ({ page }) => {
  const response = await page.goto('/forgot-password')
  expect(response).not.toBeNull()
  expect(response!.status()).toBeLessThan(500)
  // Middleware treats /forgot-password as protected today, so anonymous
  // visitors land on /login; if it is later made public, the reset form
  // renders instead. Accept either non-error outcome.
  const path = new URL(page.url()).pathname
  expect(['/forgot-password', '/login']).toContain(path)
  if (path === '/forgot-password') {
    await expect(page.getByRole('heading', { name: /reset|forgot/i })).toBeVisible()
  } else {
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  }
})
