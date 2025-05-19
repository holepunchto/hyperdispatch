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
