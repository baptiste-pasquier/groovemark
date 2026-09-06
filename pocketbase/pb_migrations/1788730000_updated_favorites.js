/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2151843437')

    // update collection data
    unmarshal(
      {
        updateRule:
          '@request.auth.id != "" && owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)',
      },
      collection,
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2151843437')

    // update collection data
    unmarshal(
      {
        updateRule: '@request.auth.id != "" && owner = @request.auth.id',
      },
      collection,
    )

    return app.save(collection)
  },
)
