const p = require('path')
const fs = require('fs')
const Hyperschema = require('hyperschema')

const generateCode = require('./lib/codegen')

const CODE_FILE_NAME = 'index.js'
const MESSAGES_FILE_NAME = 'messages.js'
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
  constructor (schema, dispatchJson, { offset, dispatchDir = null, schemaDir = null } = {}) {
    this.schema = schema
    this.version = dispatchJson ? dispatchJson.version : 0
    this.offset = dispatchJson ? dispatchJson.offset : (offset || 0)
    this.dispatchDir = dispatchDir
    this.schemaDir = schemaDir

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

  toJSON () {
    return {
      version: this.version,
      schema: this.handlers.map(({ type, ...h }) => h)
    }
  }

  static from (schemaJson, dispatchJson, opts) {
    const schema = Hyperschema.from(schemaJson)
    if (typeof dispatchJson === 'string') {
      const jsonFilePath = p.join(p.resolve(dispatchJson), DISPATCH_JSON_FILE_NAME)
      let exists = false
      try {
        fs.statSync(jsonFilePath)
        exists = true
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
      }
      opts = { ...opts, dispatchDir: dispatchJson, schemaDir: schemaJson }
      if (exists) return new this(schema, JSON.parse(fs.readFileSync(jsonFilePath)), opts)
      return new this(schema, null, opts)
    }
    return new this(schema, dispatchJson, opts)
  }

  static toDisk (hyperdispatch, dispatchDir) {
    if (!dispatchDir) dispatchDir = hyperdispatch.dispatchDir
    fs.mkdirSync(dispatchDir, { recursive: true })

    const messagesPath = p.join(p.resolve(dispatchDir), MESSAGES_FILE_NAME)
    const dispatchJsonPath = p.join(p.resolve(dispatchDir), DISPATCH_JSON_FILE_NAME)
    const codePath = p.join(p.resolve(dispatchDir), CODE_FILE_NAME)

    fs.writeFileSync(dispatchJsonPath, JSON.stringify(hyperdispatch.toJSON(), null, 2), { encoding: 'utf-8' })
    fs.writeFileSync(messagesPath, hyperdispatch.schema.toCode(), { encoding: 'utf-8' })
    fs.writeFileSync(codePath, generateCode(hyperdispatch), { encoding: 'utf-8' })
  }
}
