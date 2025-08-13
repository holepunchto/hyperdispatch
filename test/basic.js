const { spawn } = require('child_process')
const process = require('process')
const path = require('path')
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

test('basic two namespaces with interleaved op additions', async t => {
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
          }
        ]
      })
    },
    dispatch: hyperdispatch => {
      const ns1 = hyperdispatch.namespace('test1')
      ns1.register({
        name: 'test-request-1',
        requestType: '@test/request'
      })
      const ns2 = hyperdispatch.namespace('test2')
      ns2.register({
        name: 'test-request-2',
        requestType: '@test/request'
      })
    }
  }, { offset: 2 })
  hd.rebuild({
    schema: schema => {
      const ns = schema.namespace('test')
      ns.register({
        name: 'request',
        fields: [
          {
            name: 'id',
            type: 'uint'
          }
        ]
      })
    },
    dispatch: hyperdispatch => {
      const ns1 = hyperdispatch.namespace('test1')
      ns1.register({
        name: 'test-request-1',
        requestType: '@test/request'
      })
      const ns2 = hyperdispatch.namespace('test2')
      ns2.register({
        name: 'test-request-2',
        requestType: '@test/request'
      })
      ns1.register({
        name: 'test-request-3',
        requestType: '@test/request'
      })
    }
  }, { offset: 2 })
  const { encode, Router } = hd.module

  const r = new Router()
  r.add('@test1/test-request-1', (req, ctx) => {
    t.is(ctx, 'some-context')
    t.is(req.id, 10)
  })
  r.add('@test2/test-request-2', (req, ctx) => {
    t.is(ctx, 'some-context')
    t.is(req.id, 20)
  })
  r.add('@test1/test-request-3', (req, ctx) => {
    t.is(ctx, 'another-context')
    t.is(req.id, 30)
  })

  await r.dispatch(encode('@test1/test-request-1', { id: 10 }), 'some-context')
  await r.dispatch(encode('@test2/test-request-2', { id: 20 }), 'some-context')
  await r.dispatch(encode('@test1/test-request-3', { id: 30 }), 'another-context')
})

test('cannot change the offset', async t => {
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
          }
        ]
      })
    },
    dispatch: hyperdispatch => {
      const ns1 = hyperdispatch.namespace('test1')
      ns1.register({
        name: 'test-request-1',
        requestType: '@test/request'
      })
    }
  }, { offset: 2 })

  try {
    hd.rebuild({
      schema: schema => {
        const ns = schema.namespace('test')
        ns.register({
          name: 'request',
          fields: [
            {
              name: 'id',
              type: 'uint'
            }
          ]
        })
      },
      dispatch: hyperdispatch => {
        const ns1 = hyperdispatch.namespace('test1')
        ns1.register({
          name: 'test-request-1',
          requestType: '@test/request'
        })
        ns1.register({
          name: 'test-request-2',
          requestType: '@test/request'
        })
      }
    }, { offset: 4 })
    t.fail('rebuilding with different offset did not throw')
  } catch {
    t.pass('rebuilding with different offset should throw')
  }
})

test('test schema passes linter', async t => {
  t.plan(1)
  const hd = await createTestSchema(t)
  const dispatchDir = path.join(hd.dir, 'hyperdispatch')

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

  const exProc = spawn(path.join(path.dirname(__dirname), 'node_modules', '.bin', 'standard'), [dispatchDir])
  exProc.on('close', (status) => {
    t.is(status, 0, 'linter detected no issues')
  })

  // In case the test is aborted, we kill the standard process
  process.on('exit', () => { exProc.kill('SIGKILL') })

  exProc.stderr.on('data', d => {
    console.error(`[linter error output] ${d.toString()}`)
  })
})
