const p = require('path')
const fs = require('fs')

const generateCode = require('./lib/codegen')

const CODE_FILE_NAME = 'index.js'
const DISPATCH_JSON_FILE_NAME = 'dispatch.json'

class HyperdispatchNamespace {
  constructor (hyperdispatch, name) {
    this.hyperdispatch = hyperdispatch
    this.name = name
  }

  register (description) {
    const fqn = '@' + this.name + '/' + description.name
    this.hyperdispatch.register(fqn, description)
  }
}

module.exports = class Hyperdispatch {
  constructor (dispatchJson, { offset, dispatchDir = null } = {}) {
    this.version = dispatchJson ? dispatchJson.version : 0
    this.offset = dispatchJson ? dispatchJson.offset : (offset || 0)
    this.dispatchDir = dispatchDir
    this.schema = null

    this.namespaces = new Map()
    this.handlersByName = new Map()
    this.handlersById = new Map()
    this.handlers = []

    this.currentOffset = this.offset || 0

    this.changed = false
    this.initializing = true
    if (dispatchJson) {
      for (let i = 0; i < dispatchJson.schema.length; i++) {
        const description = dispatchJson.schema[i]
        this.register(description.name, description)
      }
    }
    this.initializing = false
  }

  namespace (name) {
    return new HyperdispatchNamespace(this, name)
  }

  register (fqn, description) {
    if (!this.schema) throw new Error('registerSchema must be called with a Hyperschema instance before registering handlers')

    const existingByName = this.handlersByName.get(fqn)
    const existingById = Number.isInteger(description.id) ? this.handlersById.get(description.id) : null
    if (existingByName && existingById) {
      if (existingByName !== existingById) throw new Error('ID/Name mismatch for handler: ' + fqn)
      if (Number.isInteger(description.id) && (existingByName.id !== description.id)) {
        throw new Error('Cannot change the assigned ID for handler: ' + fqn)
      }
    }

    const type = this.schema.resolve(description.requestType)
    if (!type) throw new Error('Invalid request type')

    if (existingByName && (existingByName.type !== type)) {
      throw new Error('Cannot alter the request type for a handler')
    }

    if (!this.initializing && !existingByName && !this.changed) {
      this.changed = true
      this.version += 1
    }

    const id = Number.isInteger(description.id) ? description.id : this.currentOffset++

    const handler = {
      id,
      type,
      name: fqn,
      requestType: description.requestType,
      version: Number.isInteger(description.version) ? description.version : this.version
    }

    this.handlersById.set(id, handler)
    this.handlersByName.set(fqn, handler)
    if (!existingByName) {
      this.handlers.push(handler)
    }
  }

  registerSchema (schema) {
    if (this.schema) throw new Error('Already registered a hyperschema instance')
    this.schema = schema
  }

  toJSON () {
    return {
      version: this.version,
      schema: this.handlers.map(({ type, ...h }) => h)
    }
  }

  static from (dispatchJson, opts) {
    if (typeof dispatchJson === 'string') {
      const jsonFilePath = p.join(p.resolve(dispatchJson), DISPATCH_JSON_FILE_NAME)
      let exists = false
      try {
        fs.statSync(jsonFilePath)
        exists = true
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
      }
      opts = { ...opts, dispatchDir: dispatchJson }
      if (exists) return new this(JSON.parse(fs.readFileSync(jsonFilePath)), opts)
      return new this(null, opts)
    }
    return new this(dispatchJson, opts)
  }

  static toDisk (hyperdispatch, dispatchDir) {
    if (!dispatchDir) dispatchDir = hyperdispatch.dispatchDir
    fs.mkdirSync(dispatchDir, { recursive: true })

    const dispatchJsonPath = p.join(p.resolve(dispatchDir), DISPATCH_JSON_FILE_NAME)
    const codePath = p.join(p.resolve(dispatchDir), CODE_FILE_NAME)

    fs.writeFileSync(dispatchJsonPath, JSON.stringify(hyperdispatch.toJSON(), null, 2), { encoding: 'utf-8' })
    fs.writeFileSync(codePath, generateCode(hyperdispatch, { directory: dispatchDir }), { encoding: 'utf-8' })
  }
}
