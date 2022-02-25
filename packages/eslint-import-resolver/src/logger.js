const LOG_LEVEL_OFF = "off"
const LOG_LEVEL_DEBUG = "debug"
const LOG_LEVEL_INFO = "info"
const LOG_LEVEL_WARN = "warn"
const LOG_LEVEL_ERROR = "error"

export const createLogger = ({ logLevel = LOG_LEVEL_INFO } = {}) => {
  if (logLevel === LOG_LEVEL_DEBUG) {
    return {
      debug,
      info,
      warn,
      error,
    }
  }

  if (logLevel === LOG_LEVEL_INFO) {
    return {
      debug: debugDisabled,
      info,
      warn,
      error,
    }
  }

  if (logLevel === LOG_LEVEL_WARN) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn,
      error,
    }
  }

  if (logLevel === LOG_LEVEL_ERROR) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error,
    }
  }

  if (logLevel === LOG_LEVEL_OFF) {
    return {
      debug: debugDisabled,
      info: infoDisabled,
      warn: warnDisabled,
      error: errorDisabled,
    }
  }

  throw new Error(`unexpected logLevel.
  --- logLevel ---
  ${logLevel}
  --- allowed log levels ---
  ${LOG_LEVEL_OFF}
  ${LOG_LEVEL_ERROR}
  ${LOG_LEVEL_WARN}
  ${LOG_LEVEL_INFO}
  ${LOG_LEVEL_DEBUG}`)
}

const debug = console.debug

const debugDisabled = () => {}

const info = console.info

const infoDisabled = () => {}

const warn = console.warn

const warnDisabled = () => {}

const error = console.error

const errorDisabled = () => {}
