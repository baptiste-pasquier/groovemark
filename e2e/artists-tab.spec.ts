import { test, expect } from '@playwright/test'

test.use({ locale: 'fr-FR' })

const EVENT_NAME = 'Nuits Sonores'
const EVENT_DATE = '2026-05-04'
const EVENT_VENUE = 'Les Subsistances'
const FIRST_ARTIST = 'Anetha'
const SECOND_ARTIST = 'Trym'

async function enterLocalMode(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('Bienvenue sur GrooveMark')
  await page.getByRole('button', { name: 'Continuer en mode local' }).click()
  await expect(page.locator('h1')).toHaveText('GrooveMark')
  await page.locator('[data-destination="events"]').click()
  await expect(page.locator('#add-event-btn')).toBeVisible()
}

// Records one night crediting two performers, rated so that the verdict order
// is the reverse of the alphabetical one -- otherwise a sort assertion could
// pass without the sort doing anything.
async function recordNight(page: import('@playwright/test').Page) {
  await page.locator('#add-event-btn').click()
  await expect(page.locator('h2')).toHaveText('Ajouter un événement')

  await page.locator('#event-name').fill(EVENT_NAME)
  await page.locator('#event-date').fill(EVENT_DATE)
  await page.locator('#event-venue').fill(EVENT_VENUE)

  const firstRow = page.locator('.performance-row').nth(0)
  await firstRow.locator('input').fill(FIRST_ARTIST)
  await firstRow.locator('input').press('Enter')
  await expect(firstRow).toContainText(FIRST_ARTIST)
  await firstRow.locator('[data-layout="wide"] [data-verdict="one-star"]').click()

  await page.locator('#add-performance-btn').click()
  const secondRow = page.locator('.performance-row').nth(1)
  await secondRow.locator('input').fill(SECOND_ARTIST)
  await secondRow.locator('input').press('Enter')
  await expect(secondRow).toContainText(SECOND_ARTIST)
  await secondRow.locator('[data-layout="wide"] [data-verdict="three-stars"]').click()

  await page.getByRole('button', { name: 'Sauvegarder' }).click()
  await expect(page.locator('h2')).toBeHidden({ timeout: 5000 })
}

async function openArtistsTab(page: import('@playwright/test').Page) {
  await page.locator('[data-destination="artists"]').click()
  await expect(page.locator('#artists-table')).toBeVisible({ timeout: 5000 })
}

function rowNames(page: import('@playwright/test').Page) {
  return page.locator('.artists-row .artists-row-link')
}

test('catalogues both performers, sorts the table by a column, and opens a performer from their row', async ({
  page,
}) => {
  await enterLocalMode(page)
  await recordNight(page)
  await openArtistsTab(page)

  // Both performers are catalogued from the night alone, with the columns the
  // tab is sorted by on screen and translated.
  await expect(rowNames(page)).toHaveCount(2)
  await expect(rowNames(page)).toHaveText([FIRST_ARTIST, SECOND_ARTIST])
  await expect(page.locator('.artists-sort-header[data-sort-column="artist"]')).toContainText(
    'Artiste',
  )
  await expect(
    page.locator('.artists-sort-header[data-sort-column="latestVerdict"]'),
  ).toContainText('Verdict')
  const anethaRow = page.locator('.artists-row').filter({ hasText: FIRST_ARTIST })
  await expect(anethaRow.locator('[data-column="mixes"]')).toHaveText('0')
  await expect(anethaRow.locator('[data-column="performances"]')).toHaveText('1')
  await expect(anethaRow.locator('[data-column="dateLastSeen"]')).toHaveText('4 mai 2026')

  // Sorting by the verdict column puts the best night first, and says so.
  await page.locator('.artists-sort-header[data-sort-column="latestVerdict"]').click()
  await expect(page.locator('th[data-column="latestVerdict"]')).toHaveAttribute(
    'aria-sort',
    'descending',
  )
  await expect(rowNames(page)).toHaveText([SECOND_ARTIST, FIRST_ARTIST])

  // ...and activating the same header again reverses it.
  await page.locator('.artists-sort-header[data-sort-column="latestVerdict"]').click()
  await expect(page.locator('th[data-column="latestVerdict"]')).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  await expect(rowNames(page)).toHaveText([FIRST_ARTIST, SECOND_ARTIST])

  // The search narrows the catalogue by name.
  await page.locator('#artists-search').fill('trym')
  await expect(rowNames(page)).toHaveText([SECOND_ARTIST])
  await page.locator('#artists-search').fill('')
  await expect(rowNames(page)).toHaveCount(2)

  // A row is the way into that performer's own page (KTD14).
  await page
    .locator('.artists-row')
    .filter({ hasText: SECOND_ARTIST })
    .locator('.artists-row-link')
    .click()
  await expect(page.locator('.artist-page-name')).toHaveText(SECOND_ARTIST)
  expect(page.url()).toContain('/artists/trym')
  await expect(page.locator('[data-destination="artists"]')).toHaveAttribute('aria-current', 'page')
})

test('reduces a row to the name and the active column on a phone, and changes it from the select', async ({
  page,
}) => {
  await enterLocalMode(page)
  await recordNight(page)
  await openArtistsTab(page)

  // Narrower than the first breakpoint: the compact select is the only way to
  // change which value each row shows, because the other headers are gone.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('#artists-sort-select')).toBeVisible()

  await page.locator('#artists-sort-select').selectOption('starredMoments')
  const row = page.locator('.artists-row').filter({ hasText: SECOND_ARTIST })
  await expect(row.locator('.artists-row-link')).toBeVisible()
  await expect(row.locator('[data-column="starredMoments"]')).toBeVisible()
  await expect(row.locator('[data-column="starredMoments"]')).toHaveText('0')
  await expect(row.locator('[data-column="latestVerdict"]')).toBeHidden()
  await expect(row.locator('[data-column="performances"]')).toBeHidden()

  // Changing the sort changes the value on the row (AE9).
  await page.locator('#artists-sort-select').selectOption('latestVerdict')
  await expect(row.locator('[data-column="latestVerdict"]')).toBeVisible()
  await expect(
    row.locator('[data-column="latestVerdict"]').getByRole('img', { name: 'Trois étoiles' }),
  ).toBeVisible()
  await expect(row.locator('[data-column="starredMoments"]')).toBeHidden()
})
