/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2151843437')

    // add field
    collection.fields.addAt(
      11,
      new Field({
        cascadeDelete: false,
        collectionId: 'pbc_4185980916',
        help: '',
        hidden: false,
        id: 'relation2571184304',
        maxSelect: 0,
        minSelect: 0,
        name: 'artistIds',
        presentable: false,
        required: false,
        system: false,
        type: 'relation',
      }),
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2151843437')

    // remove field
    collection.fields.removeById('relation2571184304')

    return app.save(collection)
  },
)
