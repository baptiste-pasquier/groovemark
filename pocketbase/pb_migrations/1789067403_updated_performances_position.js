/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2758201643')

    // A batch inserts every row of one save inside the same millisecond, and
    // `created` has millisecond precision -- so rows of a line-up tie and the
    // id, which is random, decides the order a read returns them in. A
    // client-set position is the only way a cloud read can reproduce the order
    // the line-up was typed in, which the repository interface promises in
    // both modes. Local mode needs nothing: nesting keeps the order for free.
    collection.fields.addAt(
      6,
      new Field({
        hidden: false,
        id: 'number2069360702',
        max: null,
        min: 0,
        name: 'position',
        onlyInt: true,
        presentable: false,
        required: false,
        system: false,
        type: 'number',
      }),
    )

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_2758201643')

    // remove field
    collection.fields.removeById('number2069360702')

    return app.save(collection)
  },
)
