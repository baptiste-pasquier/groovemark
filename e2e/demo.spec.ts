import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { demoArtists, demoEvents, demoFavorites, demoMetadata } from './fixtures/demoFavorites'

const DEMO_PAUSE_MS = 350
const demoFrameDir = process.env.PLAYWRIGHT_DEMO_FRAME_DIR

async function captureFrame(page: Page, fileName: string) {
  if (!demoFrameDir) {
    return
  }

  await mkdir(demoFrameDir, { recursive: true })
  await page.screenshot({
    path: path.join(demoFrameDir, fileName),
  })
}

async function settleFrame(page: Page) {
  // The demo capture keeps a short pause so remote thumbnails and modal transitions
  // have a stable visual state before each screenshot is written.
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(DEMO_PAUSE_MS)
}

test.use({ locale: 'en-US' })
test.setTimeout(45_000)

test('records the README demo flow', async ({ context, page }) => {
  // Three keys, because the demo now walks all three destinations. The artist
  // records are what make a credited name reach a real artist page: a mix
  // credits an artist by relation id, and an event card folds the display name
  // it carries into the address, so a missing record lands on the not-found
  // page instead.
  await context.addInitScript(
    (seed) => {
      window.localStorage.clear()
      window.localStorage.setItem('groovemark_locale', 'en')
      window.localStorage.setItem('groovemark:favorites:local', JSON.stringify(seed.favorites))
      window.localStorage.setItem('groovemark:artists:local', JSON.stringify(seed.artists))
      window.localStorage.setItem('groovemark:events:local', JSON.stringify(seed.events))
    },
    { favorites: demoFavorites, artists: demoArtists, events: demoEvents },
  )

  await page.route('https://noembed.com/embed?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: demoMetadata.title,
        author_name: demoMetadata.artist,
        thumbnail_url: demoMetadata.thumbnail,
      }),
    })
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Welcome to GrooveMark' })).toBeVisible()
  await settleFrame(page)
  await captureFrame(page, '01-welcome.png')

  await page.getByRole('button', { name: 'Continue in local mode' }).click()
  await expect(page.getByRole('heading', { name: 'GrooveMark' })).toBeVisible()
  await expect(page.getByText('Anetha | Techno DJ Set | SECTION. | November 2025')).toBeVisible()
  await settleFrame(page)
  await captureFrame(page, '02-library.png')

  await page.getByRole('button', { name: 'New favorite' }).click()
  await expect(page.getByRole('heading', { name: 'Add a favorite' })).toBeVisible()

  await page.locator('#url').fill('https://youtu.be/FGBhQbmPwH8')
  await page.locator('#title').click()
  await expect(page.locator('#title')).toHaveValue(demoMetadata.title)
  await expect(page.getByText(demoMetadata.artist)).toBeVisible()
  await settleFrame(page)
  await captureFrame(page, '03-autofill.png')

  await page.getByPlaceholder('Label (optional)').first().fill('Disco lift')
  await page.getByPlaceholder('Time (e.g. 23:45)').first().fill('0042')
  await settleFrame(page)
  await captureFrame(page, '04-timestamps.png')

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(demoMetadata.title)).toBeVisible()
  await settleFrame(page)
  await captureFrame(page, '05-saved.png')

  await expect(page.getByText('Warehouse lift')).toBeVisible()
  await settleFrame(page)

  await page.getByRole('button', { name: /Daft Punk/ }).click()
  await expect(page.getByText(demoMetadata.title)).toBeVisible()
  await expect(page.getByText('Anetha | Techno DJ Set | SECTION. | November 2025')).toBeHidden()
  await settleFrame(page)
  await captureFrame(page, '06-filtered.png')

  // The events destination: one card per attended night, newest first, each
  // with its full line-up and one badge per verdict. Addressed by the tab's
  // data attribute rather than its label, so the frame does not depend on the
  // active locale.
  await page.locator('[data-destination="events"]').click()
  await expect(page.locator('#events-grid')).toBeVisible()
  await expect(page.locator('.event-card')).toHaveCount(2)
  await expect(page.locator('.event-card').first()).toContainText('Dour Festival')
  await settleFrame(page)
  await captureFrame(page, '07-events.png')

  // A credited name is the way into that performer's own page, from the event
  // card as much as from a mix card.
  await page.locator('.event-artist-link').filter({ hasText: 'Anetha' }).first().click()
  await expect(page.locator('.artist-page-name')).toHaveText('Anetha')
  // Both halves are filled: both nights she was seen at, and one mix kept.
  await expect(page.locator('.artist-performance')).toHaveCount(2)
  await expect(page.locator('.artist-stat').first()).toHaveText('1 mix')
  await expect(page.locator('[data-destination="artists"]')).toHaveAttribute('aria-current', 'page')
  await settleFrame(page)
  await captureFrame(page, '08-artist-page.png')

  // No second artist frame: with the live half leading and the mixes half
  // summarised into chips and small cards, both halves fit above the fold, so a
  // scrolled frame captured the same pixels as the one above it.
  await expect(page.locator('.artist-mix-card').first()).toBeVisible()
})
