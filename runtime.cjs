const { DispatchError, ERRORS } = require('./lib/errors')

module.exports = {
  c: require('compact-encoding'),
  b4a: require('b4a'),
  assert: require('nanoassert'),
  DispatchError,
  ERRORS
}
