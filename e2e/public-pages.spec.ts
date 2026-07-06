import { test, expect } from '@playwright/test'

test('shared report page with an invalid token shows the invalid-link state', async ({ page }) => {
  const response = await page.goto('/share/report/invalidtoken0000')
  expect(response).not.toBeNull()
  expect(response!.status()).toBeLessThan(500)
  // Public route — must not bounce to login.
  expect(new URL(page.url()).pathname).toBe('/share/report/invalidtoken0000')
  await expect(page.getByRole('heading', { name: 'Link not available' })).toBeVisible()
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible()
})

test('approve page with an invalid token shows the invalid state', async ({ page }) => {
  const response = await page.goto('/approve/invalidtoken')
  expect(response).not.toBeNull()
  expect(response!.status()).toBeLessThan(500)
  expect(new URL(page.url()).pathname).toBe('/approve/invalidtoken')
  await expect(page.getByRole('heading', { name: /link invalid or expired/i })).toBeVisible()
  await expect(page.getByText(/contact your account manager/i)).toBeVisible()
})
