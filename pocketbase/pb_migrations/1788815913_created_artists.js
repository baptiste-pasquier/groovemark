/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collection = new Collection({
      createRule: '@request.auth.id != "" && @request.body.owner = @request.auth.id',
      deleteRule: '@request.auth.id != "" && owner = @request.auth.id',
      fields: [
        {
          autogeneratePattern: '[a-z0-9]{15}',
          help: '',
          hidden: false,
          id: 'text3208210256',
          max: 15,
          min: 15,
          name: 'id',
          pattern: '^[a-z0-9]+$',
          presentable: false,
          primaryKey: true,
          required: true,
          system: true,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          help: '',
          hidden: false,
          id: 'text1731158936',
          max: 0,
          min: 0,
          name: 'displayName',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          autogeneratePattern: '',
          help: '',
          hidden: false,
          id: 'text2560465762',
          max: 0,
          min: 0,
          name: 'slug',
          pattern: '',
          presentable: false,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          cascadeDelete: false,
          collectionId: '_pb_users_auth_',
          help: '',
          hidden: false,
          id: 'relation3479234172',
          maxSelect: 1,
          minSelect: 0,
          name: 'owner',
          presentable: false,
          required: true,
          system: false,
          type: 'relation',
        },
      ],
      id: 'pbc_4185980916',
      indexes: ['CREATE UNIQUE INDEX `idx_artists_owner_slug` ON `artists` (`owner`, `slug`)'],
      listRule: '@request.auth.id != "" && owner = @request.auth.id',
      name: 'artists',
      system: false,
      type: 'base',
      updateRule:
        '@request.auth.id != "" && owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)',
      viewRule: '@request.auth.id != "" && owner = @request.auth.id',
    })

    return app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pbc_4185980916')

    return app.delete(collection)
  },
)
