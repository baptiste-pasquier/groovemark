import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { demoFavorites, demoMetadata } from './fixtures/demoFavorites'

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
  await context.addInitScript((favorites) => {
    window.localStorage.clear()
    window.localStorage.setItem('groovemark_locale', 'en')
    window.localStorage.setItem('groovemark:favorites:local', JSON.stringify(favorites))
  }, demoFavorites)

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
})
