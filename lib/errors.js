const ERRORS = {
  NONEXISTENT_ROUTE: 'NONEXISTENT_ROUTE',
  HANDLER_NOT_FOUND_BY_ID: 'HANDLER_NOT_FOUND_BY_ID',
  ROUTE_NOT_FOUND_BY_NAME: 'ROUTE_NOT_FOUND_BY_NAME'
}

class DispatchError extends Error {
  constructor(code, message, fn = DispatchError) {
    super(message ? `${code}: ${message}` : code)
    this.code = code
    this.isDispatchError = true

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  static isDispatchError(err) {
    return err?.isDispatchError === true
  }

  static NONEXISTENT_ROUTE(name) {
    return new DispatchError(ERRORS.NONEXISTENT_ROUTE, name, DispatchError.NONEXISTENT_ROUTE)
  }

  static HANDLER_NOT_FOUND_BY_ID(id) {
    return new DispatchError(
      ERRORS.HANDLER_NOT_FOUND_BY_ID,
      id,
      DispatchError.HANDLER_NOT_FOUND_BY_ID
    )
  }

  static ROUTE_NOT_FOUND_BY_NAME(name) {
    return new DispatchError(
      ERRORS.ROUTE_NOT_FOUND_BY_NAME,
      name,
      DispatchError.ROUTE_NOT_FOUND_BY_NAME
    )
  }
}

module.exports = {
  DispatchError,
  ERRORS
}
