const p = require('path')
const fs = require('fs')
const tmp = require('test-tmp')

const Hyperschema = require('hyperschema')
const Hyperdispatch = require('../..')

class TestBuilder {
  constructor (dir) {
    this.dir = dir
    this.schemaDir = p.join(dir, 'hyperschema')
    this.dispatchDir = p.join(dir, 'hyperdispatch')
    this.module = null
    this.version = 0
  }

  rebuild (builder, opts) {
    const schema = Hyperschema.from(this.schemaDir)
    builder.schema(schema)
    Hyperschema.toDisk(schema)
    const hyperdispatch = Hyperdispatch.from(this.schemaDir, this.dispatchDir, opts)
    builder.dispatch(hyperdispatch)
    Hyperdispatch.toDisk(hyperdispatch)

    if (this.module) {
      delete require.cache[require.resolve(this.dispatchDir)]
      delete require.cache[require.resolve(p.join(this.dispatchDir, 'dispatch.json'))]
    }

    this.module = require(this.dispatchDir)
    this.json = require(p.join(this.dispatchDir, 'dispatch.json'))

    return schema
  }
}

async function createTestSchema (t) {
  const dir = await tmp(t, { dir: p.join(__dirname, '../test-storage') })

  // Copy the runtime into the tmp dir so that we don't need to override it in the codegen
  const runtimePath = p.join(dir, 'node_modules', 'hyperdispatch', 'runtime.js')
  await fs.promises.mkdir(p.dirname(runtimePath), { recursive: true })
  await fs.promises.copyFile(p.resolve(dir, '../../../runtime.js'), runtimePath)

  return new TestBuilder(dir)
}

module.exports = {
  createTestSchema
}
