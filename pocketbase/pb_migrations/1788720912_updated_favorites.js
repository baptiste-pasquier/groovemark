/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2151843437')

    // add field
    collection.fields.addAt(
      8,
      new Field({
        help: '',
        hidden: false,
        id: 'date2341372968',
        max: '',
        min: '',
        name: 'created_at',
        presentable: false,
        required: true,
        system: false,
        type: 'date',
      }),
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2151843437')

    // remove field
    collection.fields.removeById('date2341372968')

    return app.save(collection)
  },
)
