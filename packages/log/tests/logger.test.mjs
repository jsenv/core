import { assert } from "@jsenv/assert"

import { createLogger, loggerToLevels } from "@jsenv/log"

try {
  createLogger({ logLevel: "foo" })
  throw new Error("should throw")
} catch (actual) {
  const expected = new Error(`unexpected logLevel.
--- logLevel ---
foo
--- allowed log levels ---
off
error
warn
info
debug`)
  assert({ actual, expected })
}

{
  const logger = createLogger()
  const actual = loggerToLevels(logger)
  const expected = {
    debug: false,
    info: true,
    warn: true,
    error: true,
  }
  assert({ actual, expected })
}

{
  const logger = createLogger({ logLevel: "off" })
  const actual = loggerToLevels(logger)
  const expected = {
    debug: false,
    info: false,
    warn: false,
    error: false,
  }
  assert({ actual, expected })
}

{
  const logger = createLogger({ logLevel: "debug" })
  const actual = loggerToLevels(logger)
  const expected = {
    debug: true,
    info: true,
    warn: true,
    error: true,
  }
  assert({ actual, expected })
}

{
  const logger = createLogger({ logLevel: "info" })
  const actual = loggerToLevels(logger)
  const expected = {
    debug: false,
    info: true,
    warn: true,
    error: true,
  }
  assert({ actual, expected })
}

{
  const logger = createLogger({ logLevel: "warn" })
  const actual = loggerToLevels(logger)
  const expected = {
    debug: false,
    info: false,
    warn: true,
    error: true,
  }
  assert({ actual, expected })
}

{
  const logger = createLogger({ logLevel: "error" })
  const actual = loggerToLevels(logger)
  const expected = {
    debug: false,
    info: false,
    warn: false,
    error: true,
  }
  assert({ actual, expected })
}
