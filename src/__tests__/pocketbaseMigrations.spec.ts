import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Migration files execute inside PocketBase's embedded JS runtime (they call
// global `migrate`/`Field`/`app` helpers that don't exist in Node), so they
// can't be imported and run directly here. Field definitions are parsed as
// text instead, which is enough to pin config values PocketBase itself
// silently reinterprets rather than rejects (see below).
function readMigrationSource(fileName: string): string {
  const path = resolve(process.cwd(), 'pocketbase/pb_migrations', fileName)
  return readFileSync(path, 'utf-8')
}

function extractFieldBlock(source: string, fieldName: string): string {
  const pattern = new RegExp(`new Field\\(\\{[^}]*name: '${fieldName}'[^}]*\\}\\)`)
  const match = source.match(pattern)
  if (!match) {
    throw new Error(
      `Could not find a Field definition named '${fieldName}' in the migration source`,
    )
  }
  return match[0]
}

describe('PocketBase migrations', () => {
  it('gives artistIds enough maxSelect to actually be a multi-artist relation', () => {
    // PocketBase (pinned at v0.40.2 in docker/Dockerfile.pocketbase) decides
    // whether a relation field is multi-valued via `RelationField.IsMultiple()`,
    // which returns `MaxSelect > 1` -- so `maxSelect: 0` is NOT "unlimited", it
    // is single-select. Verified empirically: applying this migration against
    // the real v0.40.2 binary produces a scalar `TEXT` column for artistIds,
    // not a `JSON` array column, so a favorite credited to more than one
    // artist silently keeps only the last one on save.
    const artistIdsField = extractFieldBlock(
      readMigrationSource('1788815925_updated_favorites.js'),
      'artistIds',
    )

    const maxSelectMatch = artistIdsField.match(/maxSelect: (\d+)/)
    expect(maxSelectMatch).not.toBeNull()

    const maxSelect = Number(maxSelectMatch?.[1])
    expect(maxSelect).toBeGreaterThan(1)
  })
})
