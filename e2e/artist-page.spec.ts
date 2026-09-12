import { test, expect } from '@playwright/test'

test.use({ locale: 'fr-FR' })

const EVENT_NAME = 'Nuits Sonores'
const EVENT_DATE = '2026-05-04'
const EVENT_VENUE = 'Les Subsistances'
const ARTIST = 'Anetha'

async function enterLocalMode(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('Bienvenue sur GrooveMark')
  await page.getByRole('button', { name: 'Continuer en mode local' }).click()
  await expect(page.locator('h1')).toHaveText('GrooveMark')
  await page.locator('[data-destination="events"]').click()
  await expect(page.locator('#add-event-btn')).toBeVisible()
}

// Records one night with a single rated performance, which is the cheapest way
// to bring an artist into existence: the event modal resolves the typed name to
// an artist identity, so the artist page has a performer to show.
async function recordRatedNight(page: import('@playwright/test').Page) {
  await page.locator('#add-event-btn').click()
  await expect(page.locator('h2')).toHaveText('Ajouter un événement')

  await page.locator('#event-name').fill(EVENT_NAME)
  await page.locator('#event-date').fill(EVENT_DATE)
  await page.locator('#event-venue').fill(EVENT_VENUE)

  const row = page.locator('.performance-row').first()
  await row.locator('input').fill(ARTIST)
  await row.locator('input').press('Enter')
  await expect(row).toContainText(ARTIST)
  await row.locator('[data-layout="wide"] [data-verdict="three-stars"]').click()

  await page.getByRole('button', { name: 'Sauvegarder' }).click()
  await expect(page.locator('h2')).toBeHidden({ timeout: 5000 })
}

// What the performer's own page must show, whichever way it was reached.
async function expectArtistPage(page: import('@playwright/test').Page) {
  await expect(page.locator('.artist-page-name')).toHaveText(ARTIST)
  // The live half leads with the rated verdict and lists the night itself.
  await expect(page.locator('.artist-latest-verdict')).toContainText('4 mai 2026')
  await expect(page.locator('.artist-performance')).toHaveCount(1)
  await expect(page.locator('.artist-performance').first()).toContainText(EVENT_NAME)
  await expect(page.locator('.artist-performance').first()).toContainText(EVENT_VENUE)
  // The mixes half is rendered as empty rather than omitted, counts included.
  await expect(page.locator('#artist-mixes')).toBeVisible()
  await expect(page.locator('.artist-mixes-empty')).toBeVisible()
  await expect(page.locator('.artist-stat').first()).toHaveText('0 mix')
  // The destination switcher is still there, with the artists tab marked.
  await expect(page.locator('[data-destination="artists"]')).toHaveAttribute('aria-current', 'page')
}

test('opens a performer from a credited name, then reopens that address cold and after a reload', async ({
  page,
}) => {
  await enterLocalMode(page)
  await recordRatedNight(page)

  const card = page.locator('.event-card').filter({ hasText: EVENT_NAME })
  await expect(card).toBeVisible({ timeout: 5000 })
  await card.locator('.event-artist-link').click()

  await expectArtistPage(page)

  // The page has an address of its own (R21), keyed on the artist's slug and
  // percent-encoded by the router (KTD14).
  const address = page.url()
  expect(address).toContain('/artists/anetha')

  // Opened cold -- straight to the address, with no in-app navigation, which is
  // what a shared link or a new tab does. The address has to resolve on the
  // server side, not only inside the running app.
  await page.goto(address)
  await expectArtistPage(page)

  // ...and refreshing while on it lands on the same page rather than the
  // start address.
  await page.reload()
  await expect(page).toHaveURL(address)
  await expectArtistPage(page)
})

test('reads an address no artist answers as not found, with a way back to the artists tab', async ({
  page,
}) => {
  await enterLocalMode(page)
  await recordRatedNight(page)

  // A link shared before a rename, opened cold: documented behaviour, not an
  // empty page and not a redirect to the start address.
  await page.goto('/artists/renomme%20depuis')

  await expect(page.locator('.artist-not-found')).toBeVisible()
  await expect(page.locator('.artist-page-name')).toHaveCount(0)

  await page.locator('.artist-back-link').click()
  await expect(page).toHaveURL(/\/artists$/)
})
