import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BATCH_MAX_REQUESTS, BATCH_TIMEOUT_SECONDS, VERDICT_ORDER } from '../utils/event'

const CREATED_EVENTS = '1789067400_created_events.js'
const CREATED_PERFORMANCES = '1789067401_created_performances.js'
const ENABLE_BATCH = '1789067402_enable_batch.js'
const PERFORMANCES_POSITION = '1789067403_updated_performances_position.js'
const UPDATED_FAVORITES_ARTIST_IDS = '1788815925_updated_favorites.js'

const EVENTS_COLLECTION_ID = 'pbc_1093733721'
const PERFORMANCES_COLLECTION_ID = 'pbc_2758201643'
const ARTISTS_COLLECTION_ID = 'pbc_4185980916'
const USERS_COLLECTION_ID = '_pb_users_auth_'

const OWNER_SCOPED_READ_RULE = '@request.auth.id != "" && owner = @request.auth.id'
const OWNER_SCOPED_CREATE_RULE = '@request.auth.id != "" && @request.body.owner = @request.auth.id'
const OWNER_SCOPED_UPDATE_RULE =
  '@request.auth.id != "" && owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)'

// KTD15's pinned relation guard: a performance owned by the caller must not be
// able to point at another account's event, nor credit another account's
// artist. Pinned verbatim here rather than checked loosely, because a guard
// that never evaluates fails closed -- it would reject every event save.
const EVENT_RELATION_GUARD =
  '@collection.events.id ?= @request.body.eventId && @collection.events.owner ?= @request.auth.id'
const ARTIST_RELATION_GUARD =
  '@collection.artists.id ?= @request.body.artistId && @collection.artists.owner ?= @request.auth.id'

const PERFORMANCES_CREATE_RULE = `${OWNER_SCOPED_CREATE_RULE} && ${EVENT_RELATION_GUARD} && ${ARTIST_RELATION_GUARD}`
const PERFORMANCES_UPDATE_RULE = `${OWNER_SCOPED_UPDATE_RULE} && (@request.body.eventId:isset = false || (${EVENT_RELATION_GUARD})) && (@request.body.artistId:isset = false || (${ARTIST_RELATION_GUARD}))`

// Migration files execute inside PocketBase's embedded JS runtime (they call
// global `migrate`/`Field`/`app` helpers that don't exist in Node), so they
// can't be imported and run directly here. Field definitions are parsed as
// text instead, which is enough to pin config values PocketBase itself
// silently reinterprets rather than rejects (see below).
function readMigrationSource(fileName: string): string {
  const path = resolve(process.cwd(), 'pocketbase/pb_migrations', fileName)
  return readFileSync(path, 'utf-8')
}

// A field config appears in two shapes across the migrations: a flat
// `new Field({ ... })` call in an updated-collection migration, and a bare
// object literal inside a created-collection migration's `fields: [...]`
// array. Neither nests another brace block, so matching the innermost block
// that names the field covers both shapes without loosening anything the
// callers assert about the config it contains.
function extractFieldBlock(source: string, fieldName: string): string {
  const pattern = new RegExp(`\\{[^{}]*name: '${fieldName}'[^{}]*\\}`)
  const match = source.match(pattern)
  if (!match) {
    throw new Error(
      `Could not find a field definition named '${fieldName}' in the migration source`,
    )
  }
  return match[0]
}

function readNumberConfig(fieldBlock: string, key: string): number {
  const match = fieldBlock.match(new RegExp(`${key}: (-?\\d+)`))
  if (!match) {
    throw new Error(`Could not find a numeric '${key}' in the field definition`)
  }
  return Number(match[1])
}

function readBooleanConfig(fieldBlock: string, key: string): boolean {
  const match = fieldBlock.match(new RegExp(`${key}: (true|false)`))
  if (!match) {
    throw new Error(`Could not find a boolean '${key}' in the field definition`)
  }
  return match[1] === 'true'
}

function readStringConfig(fieldBlock: string, key: string): string {
  const match = fieldBlock.match(new RegExp(`${key}: '([^']*)'`))
  if (!match) {
    throw new Error(`Could not find a string '${key}' in the field definition`)
  }
  return match[1]
}

// Collection-level rules are long enough that Prettier wraps some of them onto
// the line after the key, so the whitespace between key and value is variable.
// Rule expressions themselves only ever contain double quotes.
function extractCollectionRule(source: string, ruleName: string): string {
  const match = source.match(new RegExp(`${ruleName}:\\s*'([^']*)'`))
  if (!match) {
    throw new Error(`Could not find a '${ruleName}' in the migration source`)
  }
  return match[1]
}

// Reads the whole number assigned to a settings path. Matched as a number
// rather than as a substring, so a bound of 30 cannot satisfy an expectation
// of 3.
function readSettingsNumber(source: string, path: string): number {
  const match = source.match(new RegExp(`${path.replace(/\./g, '\\.')} = (\\d+)\\b`))
  if (!match) {
    throw new Error(`Could not find a numeric assignment to '${path}' in the migration source`)
  }
  return Number(match[1])
}

// The second `(app) => {` callback passed to `migrate` is the down function.
function extractDownFunction(source: string): string {
  const marker = '  (app) => {'
  const up = source.indexOf(marker)
  const down = up === -1 ? -1 : source.indexOf(marker, up + marker.length)
  if (down === -1) {
    throw new Error('Migration source has no second `migrate` callback (no down function)')
  }
  return source.slice(down)
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
      readMigrationSource(UPDATED_FAVORITES_ARTIST_IDS),
      'artistIds',
    )

    expect(readNumberConfig(artistIdsField, 'maxSelect')).toBeGreaterThan(1)
  })

  describe('field extractor', () => {
    // The extractor used to require a flat `new Field({` declaration, so it
    // threw rather than reading a field out of a created-collection migration.
    // Both shapes are covered here so a future narrowing of it fails loudly
    // instead of leaving the assertions below silently unreachable.
    it('reads a field declared inside a collection-creation block', () => {
      const ownerField = extractFieldBlock(readMigrationSource(CREATED_EVENTS), 'owner')
      expect(readStringConfig(ownerField, 'type')).toBe('relation')
      expect(readStringConfig(ownerField, 'collectionId')).toBe(USERS_COLLECTION_ID)

      const eventIdField = extractFieldBlock(readMigrationSource(CREATED_PERFORMANCES), 'eventId')
      expect(readStringConfig(eventIdField, 'type')).toBe('relation')
    })

    it('still reads the flat new Field declaration it already covered', () => {
      const artistIdsField = extractFieldBlock(
        readMigrationSource(UPDATED_FAVORITES_ARTIST_IDS),
        'artistIds',
      )
      expect(artistIdsField).toContain("name: 'artistIds'")
      expect(readStringConfig(artistIdsField, 'type')).toBe('relation')
    })
  })

  describe('events collection', () => {
    it('stores dateAttended as a required, client-settable date', () => {
      // KTD10: a plain `date` field, not an `autodate` -- an imported or
      // back-dated event has to be able to carry the night it happened.
      const dateAttended = extractFieldBlock(readMigrationSource(CREATED_EVENTS), 'dateAttended')
      expect(readStringConfig(dateAttended, 'type')).toBe('date')
      expect(readBooleanConfig(dateAttended, 'required')).toBe(true)
    })

    it('requires a name', () => {
      const name = extractFieldBlock(readMigrationSource(CREATED_EVENTS), 'name')
      expect(readStringConfig(name, 'type')).toBe('text')
      expect(readBooleanConfig(name, 'required')).toBe(true)
    })

    it('scopes every rule to the owning account', () => {
      const source = readMigrationSource(CREATED_EVENTS)
      expect(extractCollectionRule(source, 'listRule')).toBe(OWNER_SCOPED_READ_RULE)
      expect(extractCollectionRule(source, 'viewRule')).toBe(OWNER_SCOPED_READ_RULE)
      expect(extractCollectionRule(source, 'deleteRule')).toBe(OWNER_SCOPED_READ_RULE)
      // R25: the create rule rejects an owner submitted by anyone else.
      expect(extractCollectionRule(source, 'createRule')).toBe(OWNER_SCOPED_CREATE_RULE)
      expect(extractCollectionRule(source, 'updateRule')).toBe(OWNER_SCOPED_UPDATE_RULE)
    })
  })

  describe('performances collection', () => {
    it('declares both relations single-select on the exact value', () => {
      // KTD11: `maxSelect: 0` is single-select too, but silently so -- the
      // exact value is pinned here so a relation can never be left to default
      // into the shape whose failure mode is invisible.
      const source = readMigrationSource(CREATED_PERFORMANCES)
      expect(readNumberConfig(extractFieldBlock(source, 'eventId'), 'maxSelect')).toBe(1)
      expect(readNumberConfig(extractFieldBlock(source, 'artistId'), 'maxSelect')).toBe(1)
    })

    it('points each relation at the collection it belongs to', () => {
      const source = readMigrationSource(CREATED_PERFORMANCES)
      expect(readStringConfig(extractFieldBlock(source, 'eventId'), 'collectionId')).toBe(
        EVENTS_COLLECTION_ID,
      )
      expect(readStringConfig(extractFieldBlock(source, 'artistId'), 'collectionId')).toBe(
        ARTISTS_COLLECTION_ID,
      )
      // The id quoted above has to be the one the events migration fixes.
      expect(readMigrationSource(CREATED_EVENTS)).toContain(`id: '${EVENTS_COLLECTION_ID}'`)
    })

    it('cascades on the event relation and only on the event relation', () => {
      // KTD15: a performance exists as part of its event and nowhere else
      // (R2), so deleting the event deletes it. Deleting an artist must not
      // delete the nights they played.
      const source = readMigrationSource(CREATED_PERFORMANCES)
      expect(readBooleanConfig(extractFieldBlock(source, 'eventId'), 'cascadeDelete')).toBe(true)
      expect(readBooleanConfig(extractFieldBlock(source, 'artistId'), 'cascadeDelete')).toBe(false)
    })

    it('accepts exactly the four verdicts and at most one of them', () => {
      // R2/R3: one verdict at most, drawn from the scale U1 defines.
      const verdict = extractFieldBlock(readMigrationSource(CREATED_PERFORMANCES), 'verdict')
      expect(readStringConfig(verdict, 'type')).toBe('select')
      expect(readNumberConfig(verdict, 'maxSelect')).toBe(1)
      expect(readBooleanConfig(verdict, 'required')).toBe(false)

      const values = verdict.match(/values: \[([^\]]*)\]/)?.[1] ?? ''
      const declared = values.split(',').map((value) => value.trim().replace(/'/g, ''))
      expect(declared).toEqual(Object.keys(VERDICT_ORDER))
    })

    it('guards both relations against another account in the create rule', () => {
      const rule = extractCollectionRule(readMigrationSource(CREATED_PERFORMANCES), 'createRule')
      expect(rule).toBe(PERFORMANCES_CREATE_RULE)
    })

    it('guards both relations against another account in the update rule', () => {
      const rule = extractCollectionRule(readMigrationSource(CREATED_PERFORMANCES), 'updateRule')
      expect(rule).toBe(PERFORMANCES_UPDATE_RULE)
    })

    it('scopes reads and deletes to the owning account', () => {
      const source = readMigrationSource(CREATED_PERFORMANCES)
      expect(extractCollectionRule(source, 'listRule')).toBe(OWNER_SCOPED_READ_RULE)
      expect(extractCollectionRule(source, 'viewRule')).toBe(OWNER_SCOPED_READ_RULE)
      expect(extractCollectionRule(source, 'deleteRule')).toBe(OWNER_SCOPED_READ_RULE)
    })
  })

  describe('batch settings migration', () => {
    it('writes the same bounds the client refuses an oversized batch against', () => {
      // No schema assertion covers a settings change, and the settings
      // endpoint is superuser-only so the client cannot read the values back:
      // this is the only thing keeping the migration and U1's constants from
      // drifting apart (KTD2).
      const source = readMigrationSource(ENABLE_BATCH)
      expect(source).toContain('settings.batch.enabled = true')
      expect(readSettingsNumber(source, 'settings.batch.maxRequests')).toBe(BATCH_MAX_REQUESTS)
      expect(readSettingsNumber(source, 'settings.batch.timeout')).toBe(BATCH_TIMEOUT_SECONDS)
    })
  })

  describe('reversibility and ordering', () => {
    it('gives every new migration a down function that reverses its up', () => {
      for (const [fileName, collectionId] of [
        [CREATED_EVENTS, EVENTS_COLLECTION_ID],
        [CREATED_PERFORMANCES, PERFORMANCES_COLLECTION_ID],
      ]) {
        const source = readMigrationSource(fileName)
        expect(source).toContain('new Collection({')
        const down = extractDownFunction(source)
        expect(down).toContain(`findCollectionByNameOrId('${collectionId}')`)
        expect(down).toContain('app.delete(collection)')
      }

      const batchDown = extractDownFunction(readMigrationSource(ENABLE_BATCH))
      expect(batchDown).toContain('settings.batch.enabled = false')
      expect(batchDown).toContain('app.save(settings)')
    })

    it('orders the filenames so events is created before performances references it', () => {
      // PocketBase applies migrations in filename order and reverts them in
      // reverse, so this ordering is also what makes the down direction legal:
      // performances is dropped before the events collection it references.
      const applied = [CREATED_EVENTS, CREATED_PERFORMANCES, ENABLE_BATCH, PERFORMANCES_POSITION]
      expect([...applied].sort()).toEqual(applied)
    })

    it('removes the position field when the position migration is reverted', () => {
      const down = extractDownFunction(readMigrationSource(PERFORMANCES_POSITION))
      expect(down).toContain(`findCollectionByNameOrId('${PERFORMANCES_COLLECTION_ID}')`)
      expect(down).toContain('collection.fields.removeById(')
    })
  })

  describe('performance order', () => {
    // A batch writes every row of one save inside the same millisecond, and
    // `created` has millisecond precision -- so rows of a line-up tie and the
    // random id decides the order a read returns them in. Measured against the
    // pinned server, a five-row line-up typed 1,2,3,4,5 came back 1,3,4,2,5.
    // A client-set position is what lets a cloud read reproduce entry order,
    // which the repository interface promises in both modes (KTD3).
    it('adds an integer position field to performances', () => {
      const field = extractFieldBlock(readMigrationSource(PERFORMANCES_POSITION), 'position')
      expect(field).toContain("type: 'number'")
      expect(field).toContain('onlyInt: true')
      expect(field).toContain('min: 0')
    })

    it('targets the performances collection rather than events', () => {
      const source = readMigrationSource(PERFORMANCES_POSITION)
      expect(source).toContain(`findCollectionByNameOrId('${PERFORMANCES_COLLECTION_ID}')`)
      expect(source).not.toContain(EVENTS_COLLECTION_ID)
    })
  })
})
