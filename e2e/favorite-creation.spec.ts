import { test, expect } from '@playwright/test'

test.use({ locale: 'fr-FR' })

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const YOUTUBE_EXPECTED_TITLE = 'Never Gonna Give You Up'
const YOUTUBE_EXPECTED_ARTIST = 'Rick Astley'

const SOUNDCLOUD_URL = 'https://soundcloud.com/octobersveryown/drake-gods-plan'
const SOUNDCLOUD_EXPECTED_TITLE = "God's Plan"
const SOUNDCLOUD_EXPECTED_ARTIST = 'octobersveryown'

async function enterLocalMode(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('Bienvenue sur GrooveMark')
  await page.getByRole('button', { name: 'Continuer en mode local' }).click()
  await expect(page.locator('h1')).toHaveText('GrooveMark')
}

test('creates a YouTube favorite with pre-filled metadata and timestamp', async ({ page }) => {
  await enterLocalMode(page)

  await page.getByRole('button', { name: 'Nouveau favori' }).click()
  await expect(page.locator('h2')).toHaveText('Ajouter un favori')

  const urlInput = page.locator('#url')
  const titleInput = page.locator('#title')

  await urlInput.fill(YOUTUBE_URL)
  await titleInput.click()

  await expect(titleInput).toHaveValue(new RegExp(YOUTUBE_EXPECTED_TITLE), { timeout: 15000 })

  const artistArea = page.locator('form')
  await expect(artistArea).toContainText(YOUTUBE_EXPECTED_ARTIST, { timeout: 5000 })

  const timestampLabel = page.locator('.timestamp-label').first()
  const timestampTime = page.locator('.timestamp-time').first()
  await timestampLabel.fill('Drop')
  await timestampTime.fill('0130')
  await expect(timestampTime).toHaveValue('01:30')

  await page.getByRole('button', { name: 'Sauvegarder' }).click()

  await expect(page.locator('h2')).toBeHidden({ timeout: 5000 })

  const card = page.locator('h3', { hasText: new RegExp(YOUTUBE_EXPECTED_TITLE) })
  await expect(card).toBeVisible({ timeout: 5000 })

  const cardContainer = card.locator('..').locator('..')
  await expect(cardContainer).toContainText(YOUTUBE_EXPECTED_ARTIST)

  const grid = page.locator('.font-mono', { hasText: '01:30' })
  await expect(grid).toBeVisible()
})

test('creates a SoundCloud favorite with pre-filled metadata and timestamp', async ({ page }) => {
  await enterLocalMode(page)

  await page.getByRole('button', { name: 'Nouveau favori' }).click()
  await expect(page.locator('h2')).toHaveText('Ajouter un favori')

  const urlInput = page.locator('#url')
  const titleInput = page.locator('#title')

  await urlInput.fill(SOUNDCLOUD_URL)
  await titleInput.click()

  await expect(titleInput).toHaveValue(new RegExp(SOUNDCLOUD_EXPECTED_TITLE), { timeout: 15000 })

  const artistArea = page.locator('form')
  await expect(artistArea).toContainText(SOUNDCLOUD_EXPECTED_ARTIST, { timeout: 5000 })

  const timestampLabel = page.locator('.timestamp-label').first()
  const timestampTime = page.locator('.timestamp-time').first()
  await timestampLabel.fill('Intro')
  await timestampTime.fill('0045')
  await expect(timestampTime).toHaveValue('00:45')

  await page.getByRole('button', { name: 'Sauvegarder' }).click()

  await expect(page.locator('h2')).toBeHidden({ timeout: 5000 })

  const card = page.locator('h3', { hasText: new RegExp(SOUNDCLOUD_EXPECTED_TITLE) })
  await expect(card).toBeVisible({ timeout: 5000 })

  const cardContainer = card.locator('..').locator('..')
  await expect(cardContainer).toContainText(SOUNDCLOUD_EXPECTED_ARTIST)

  const grid = page.locator('.font-mono', { hasText: '00:45' })
  await expect(grid).toBeVisible()

  const soundcloudIcon = page
    .locator('svg[role="img"]')
    .filter({ has: page.locator('title', { hasText: 'SoundCloud' }) })
  await expect(soundcloudIcon).toBeVisible()
})
