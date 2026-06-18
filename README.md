# hyperdispatch

Generate operations/endpoints using [Hyperschema](https://github.com/holepunchto/hyperschema).

You define **commands** (named routes), each backed by a Hyperschema **request type**. hyperdispatch generates code that lets you:

- `encode(command, payload)` → a compact binary message (an op).
- `new Router()` + `router.dispatch(message, context)` → decode that message and run the handler registered for its command.

This is the routing layer used to drive operations through an [Autobase](https://github.com/holepunchto/autobase) `apply` function (or [Autobee](https://github.com/holepunchto/autobee)).

```
npm install hyperdispatch
```

## How it works

There are two phases:

1. **Build (run once, in a build script):** describe your schema + commands, write generated code to disk.
2. **Runtime (your app):** `require` the generated code and use `encode` / `Router`.

```
build.js  ──▶  spec/hyperschema/     (schema.json, index.js, messages...)
          ──▶  spec/hyperdispatch/   (dispatch.json, messages.js, index.js)  ◀── your app imports this
```

---

## 1. Generating the schema + dispatch code

Write a build script and run it with `node build.js`. Re-run it whenever you add or change commands.

```js
// build.js
const Hyperschema = require('hyperschema')
const Hyperdispatch = require('hyperdispatch')

const SCHEMA_DIR = './spec/hyperschema'
const DISPATCH_DIR = './spec/hyperdispatch'

// --- a) Define request types (the shape of each payload) ---
const schema = Hyperschema.from(SCHEMA_DIR)
const ns = schema.namespace('example')

ns.register({
  name: 'request1',
  fields: [
    { name: 'field1', type: 'uint' },
    { name: 'field2', type: 'string' }
  ]
})

ns.register({
  name: 'request2',
  fields: [
    { name: 'field1', type: 'string' },
    { name: 'field2', type: 'uint' }
  ]
})

Hyperschema.toDisk(schema)

// --- b) Define commands, each bound to a request type ---
const hyperdispatch = Hyperdispatch.from(SCHEMA_DIR, DISPATCH_DIR)
const cmds = hyperdispatch.namespace('example')

cmds.register({ name: 'command1', requestType: '@example/request1' })
cmds.register({ name: 'command2', requestType: '@example/request1' })
cmds.register({ name: 'command3', requestType: '@example/request2' })

Hyperdispatch.toDisk(hyperdispatch)
```

Naming: registering `command1` in namespace `example` gives it the fully-qualified name `@example/command1`. The `requestType` references a schema type by its fully-qualified name (`@example/request1`).

This writes `spec/hyperdispatch/index.js` (the `Router` + `encode`/`decode`) and `spec/hyperdispatch/messages.js`. Commit the generated files — they're what your app imports.

> Each command is assigned a stable numeric `id` (this is what goes on the wire). IDs only ever grow, so adding new commands later is backwards-compatible. Use `Hyperdispatch.from(..., { offset })` if you need ids to start above a reserved range.

---

## 2. Encoding & dispatching

```js
const { Router, encode } = require('./spec/hyperdispatch')

const router = new Router()

// Register a handler per command. Signature: (payload, context)
router.add('@example/command1', (data, context) => {
  console.log('command1', data, context) // data is the decoded request1
})
router.add('@example/command3', (data, context) => {
  console.log('command3', data, context)
})

// Encode a message (a compact Buffer)...
const msg = encode('@example/command1', { field1: 42, field2: 'hello' })

// ...then dispatch it. `context` is passed straight through to the handler.
await router.dispatch(msg, { user: 'alice' })
```

Notes:

- `router.dispatch(message, context)` accepts either an encoded `Buffer` (it will `decode` it) or an already-decoded op `{ id, name, value }`.
- You **must** register a handler for every command before the first `dispatch`, or it throws `Missing handler for ...`.
- `decode(buffer)` is also exported if you just want to inspect a message: `{ id, name, value }`.
- Errors are `DispatchError` instances with a `.code` (`NONEXISTENT_ROUTE`, `ROUTE_NOT_FOUND_BY_NAME`, `HANDLER_NOT_FOUND_BY_ID`).

---

## 3. Using it inside Autobase / Autobee

This is the main use case. The generated `encode` produces the op you append to the base; the `Router` runs inside `apply` to mutate the view. The `context` you pass to `dispatch` is how you hand the `view` and `base` to your handlers.

```js
const { Router, encode } = require('./spec/hyperdispatch')

// 1. One router for the whole base. Handlers mutate the view.
const router = new Router()

router.add('@example/command1', async (data, context) => {
  // context.view is the Hyperbee/Autobee view, context.base is the Autobase
  await context.view.put(String(data.field1), data.field2)
})

router.add('@example/command3', async (data, context) => {
  await context.view.del(data.field1)
})

// 2. Wire the router into apply. Each node.value is an encoded op.
async function apply (nodes, view, base) {
  for (const node of nodes) {
    await router.dispatch(node.value, { view, base })
  }
}

const base = new Autobase(store, bootstrap, {
  apply,
  open (store) {
    return new Hyperbee(store.get('view'), {
      keyEncoding: 'utf-8',
      valueEncoding: 'utf-8',
      extension: false
    })
  }
})

// 3. To perform an operation, append an *encoded* message:
await base.append(encode('@example/command1', { field1: 42, field2: 'hello' }))
await base.append(encode('@example/command3', { field1: 'world', field2: 99 }))
```

Why this pattern: every writer appends the same self-describing binary ops, and `apply` deterministically replays them through the router into the view. Adding a feature = add a command in `build.js`, regenerate, add one `router.add(...)`, and start appending it.

For an [Autobee](https://github.com/holepunchto/autobee) the `view` in your handlers is the Hyperbee, so handlers call `view.put` / `view.del` directly as above.

---

## ESM

Both the builder and the generated code support ESM. Generate ESM output with:

```js
import Hyperdispatch from 'hyperdispatch'      // ESM builder emits ESM code
Hyperdispatch.toDisk(hyperdispatch, { esm: true })
```

then `import { Router, encode } from './spec/hyperdispatch/index.js'`.

## License

Apache-2.0
