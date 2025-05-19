const test = require('brittle')
const c = require('compact-encoding')

const { createTestSchema } = require('./helpers')

test('basic sync switch', async t => {
  t.plan(6)

  const hd = await createTestSchema(t)
  hd.rebuild({
    schema: schema => {
      const ns = schema.namespace('test')
      ns.register({
        name: 'request',
        fields: [
          {
            name: 'id',
            type: 'uint'
          },
          {
            name: 'str',
            type: 'string'
          }
        ]
      })
    },
    dispatch: hyperdispatch => {
      const ns = hyperdispatch.namespace('test')
      ns.register({
        name: 'test-request-1',
        requestType: '@test/request'
      })
      ns.register({
        name: 'test-request-2',
        requestType: '@test/request'
      })
    }
  })
  const { encode, Router } = hd.module

  const r = new Router()
  r.add('@test/test-request-1', (req, ctx) => {
    t.is(ctx, 'some-context')
    t.is(req.id, 10)
    t.is(req.str, 'hello')
  })
  r.add('@test/test-request-2', (req, ctx) => {
    t.is(ctx, 'another-context')
    t.is(req.id, 20)
    t.is(req.str, 'world')
  })

  await r.dispatch(encode('@test/test-request-1', { id: 10, str: 'hello' }), 'some-context')
  await r.dispatch(encode('@test/test-request-2', { id: 20, str: 'world' }), 'another-context')
})

test('basic sync switch + offset', async t => {
  const hd = await createTestSchema(t)
  hd.rebuild({
    schema: schema => {
      const ns = schema.namespace('test')
      ns.register({
        name: 'request',
        fields: [
          {
            name: 'id',
            type: 'uint'
          },
          {
            name: 'str',
            type: 'string'
          }
        ]
      })
    },
    dispatch: hyperdispatch => {
      const ns = hyperdispatch.namespace('test')
      ns.register({
        name: 'test-request-1',
        requestType: '@test/request'
      })
      ns.register({
        name: 'test-request-2',
        requestType: '@test/request'
      })
    }
  }, { offset: 10 })
  const { encode } = hd.module

  const msg1 = encode('@test/test-request-1', { id: 10, str: 'hello' })
  const msg2 = encode('@test/test-request-2', { id: 10, str: 'world' })
  t.is(c.decode(c.uint, msg1), 10)
  t.is(c.decode(c.uint, msg2), 11)
})

test('can both encode and decode ops', async t => {
  const hd = await createTestSchema(t)
  hd.rebuild({
    schema: schema => {
      const ns = schema.namespace('test')
      ns.register({
        name: 'request',
        fields: [
          {
            name: 'id',
            type: 'uint'
          },
          {
            name: 'str',
            type: 'string'
          }
        ]
      })
    },
    dispatch: hyperdispatch => {
      const ns = hyperdispatch.namespace('test')
      ns.register({
        name: 'test-request-1',
        requestType: '@test/request'
      })
      ns.register({
        name: 'test-request-2',
        requestType: '@test/request'
      })
    }
  }, { offset: 10 })
  const { encode, decode } = hd.module

  const encoded1 = encode('@test/test-request-1', { id: 10, str: 'hello' })
  const encoded2 = encode('@test/test-request-2', { id: 10, str: 'world' })

  const decoded1 = decode(encoded1)
  const decoded2 = decode(encoded2)
  t.is(decoded1.name, '@test/test-request-1')
  t.is(decoded2.name, '@test/test-request-2')
  t.is(decoded1.value.id, 10)
  t.is(decoded2.value.str, 'world')
})
