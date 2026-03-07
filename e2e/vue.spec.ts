import { test, expect } from '@playwright/test'

test.use({ locale: 'fr-FR' })

test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('Bienvenue sur GrooveMark')
  await page.getByRole('button', { name: 'Continuer en mode local' }).click()
  await expect(page.locator('h1')).toHaveText('GrooveMark')
})
