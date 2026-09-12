import { test, expect } from '@playwright/test'

test.use({ locale: 'fr-FR' })

const EVENT_NAME = 'Nuits Sonores'
const EVENT_DATE = '2026-05-04'
const MISTYPED_VENUE = 'Les Subsitances'
const CORRECTED_VENUE = 'Les Subsistances'
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

// Commits one performance's artist the way the operator does: type the name
// into the row's artist field and press Enter.
async function creditArtist(
  page: import('@playwright/test').Page,
  rowIndex: number,
  artistName: string,
) {
  const row = page.locator('.performance-row').nth(rowIndex)
  await row.locator('input').fill(artistName)
  await row.locator('input').press('Enter')
  await expect(row).toContainText(artistName)
}

test('records a night out with several performances and reads it back on its card', async ({
  page,
}) => {
  await enterLocalMode(page)

  await page.locator('#add-event-btn').click()
  await expect(page.locator('h2')).toHaveText('Ajouter un événement')

  await page.locator('#event-name').fill(EVENT_NAME)
  await page.locator('#event-date').fill(EVENT_DATE)
  await page.locator('#event-venue').fill(MISTYPED_VENUE)

  await creditArtist(page, 0, FIRST_ARTIST)
  await page.locator('#add-performance-btn').click()
  await creditArtist(page, 1, SECOND_ARTIST)

  // Three stars on the first performance, nothing on the second: an unrated
  // performance still records that the operator saw that artist.
  await page
    .locator('.performance-row')
    .nth(0)
    .locator('[data-layout="wide"] [data-verdict="three-stars"]')
    .click()

  await page.getByRole('button', { name: 'Sauvegarder' }).click()
  await expect(page.locator('h2')).toBeHidden({ timeout: 5000 })

  const card = page.locator('.event-card').filter({ hasText: EVENT_NAME })
  await expect(card).toBeVisible({ timeout: 5000 })
  await expect(card.locator('.event-card-name')).toHaveText(EVENT_NAME)
  await expect(card.locator('.event-card-venue')).toContainText(MISTYPED_VENUE)
  await expect(card.locator('.event-performance')).toHaveCount(2)
  await expect(card.locator('.event-performance').nth(0)).toContainText(FIRST_ARTIST)
  await expect(card.locator('.event-performance').nth(1)).toContainText(SECOND_ARTIST)
  await expect(card.getByRole('img', { name: 'Trois étoiles' })).toBeVisible()
  await expect(card.locator('.event-performance').nth(1)).toContainText('non noté')

  // Reopened from its own card, the same surface presents every field and
  // every performance for revision.
  await card.locator('.event-card-open').click()
  await expect(page.locator('h2')).toHaveText("Éditer l'événement")
  await expect(page.locator('#event-name')).toHaveValue(EVENT_NAME)
  await expect(page.locator('#event-date')).toHaveValue(EVENT_DATE)
  await expect(page.locator('#event-venue')).toHaveValue(MISTYPED_VENUE)
  await expect(page.locator('.performance-row')).toHaveCount(2)

  await page.locator('#event-venue').fill(CORRECTED_VENUE)
  await page.getByRole('button', { name: 'Sauvegarder' }).click()
  await expect(page.locator('h2')).toBeHidden({ timeout: 5000 })

  // Correcting the venue leaves the line-up exactly as it was, and no second
  // event is recorded.
  await expect(page.locator('.event-card')).toHaveCount(1)
  const correctedCard = page.locator('.event-card').filter({ hasText: EVENT_NAME })
  await expect(correctedCard.locator('.event-card-venue')).toContainText(CORRECTED_VENUE)
  await expect(correctedCard.locator('.event-performance')).toHaveCount(2)
  await expect(correctedCard.getByRole('img', { name: 'Trois étoiles' })).toBeVisible()
})

test('records an event holding no performance and suggests its venue to the next one', async ({
  page,
}) => {
  await enterLocalMode(page)

  await page.locator('#add-event-btn').click()
  await page.locator('#event-name').fill('Soirée sans line-up')
  await page.locator('#event-date').fill('2026-06-12')
  await page.locator('#event-venue').fill('Le Sucre')
  // The one empty row is removed with no confirmation: an event holding no
  // performance is valid.
  await page.locator('.performance-row .remove-performance-btn').click()
  await expect(page.locator('.performance-row')).toHaveCount(0)

  await page.getByRole('button', { name: 'Sauvegarder' }).click()
  await expect(page.locator('h2')).toBeHidden({ timeout: 5000 })

  const card = page.locator('.event-card').filter({ hasText: 'Soirée sans line-up' })
  await expect(card).toBeVisible({ timeout: 5000 })
  await expect(card.locator('.event-performance')).toHaveCount(0)

  // The venue that event used is now offered to the next one.
  await page.locator('#add-event-btn').click()
  const venueList = await page.locator('#event-venue').getAttribute('list')
  await expect(page.locator(`datalist#${venueList} option[value="Le Sucre"]`)).toHaveCount(1)
})

test('deletes a night only after a confirmation naming what goes with it', async ({ page }) => {
  await enterLocalMode(page)

  await page.locator('#add-event-btn').click()
  await page.locator('#event-name').fill(EVENT_NAME)
  await page.locator('#event-date').fill(EVENT_DATE)
  await page.locator('#event-venue').fill(CORRECTED_VENUE)
  await creditArtist(page, 0, FIRST_ARTIST)
  await page.locator('#add-performance-btn').click()
  await creditArtist(page, 1, SECOND_ARTIST)
  await page.getByRole('button', { name: 'Sauvegarder' }).click()
  await expect(page.locator('h2')).toBeHidden({ timeout: 5000 })

  const card = page.locator('.event-card').filter({ hasText: EVENT_NAME })
  await card.locator('.event-card-delete').click()

  // The confirmation states how many performances go with the night, because
  // the operator cannot address those rows individually.
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('retire 2 performances')

  // Dismissed, nothing is removed.
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(card).toBeVisible()
  await expect(card.locator('.event-performance')).toHaveCount(2)

  await card.locator('.event-card-delete').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()

  await expect(page.locator('.event-card')).toHaveCount(0)

  // A performer the deleted night was the only credit for leaves the
  // catalogue, which is what the artists tab lists: credits, not records.
  await page.locator('[data-destination="artists"]').click()
  await expect(page.locator('.artists-row')).toHaveCount(0)
})
