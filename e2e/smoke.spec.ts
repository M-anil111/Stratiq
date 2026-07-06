import { test, expect } from '@playwright/test'

test('home page responds and sends anonymous visitors to /login', async ({ page }) => {
  const response = await page.goto('/')
  expect(response).not.toBeNull()
  expect(response!.status()).toBeLessThan(500)
  // "/" redirects to /dashboard, and unauthenticated users are then
  // redirected to /login by the middleware.
  await page.waitForURL('**/login**')
  expect(new URL(page.url()).pathname).toBe('/login')
})
