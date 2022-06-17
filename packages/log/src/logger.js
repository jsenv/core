import {
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARN,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_OFF,
} from "./LOG_LEVELS.js"

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

const debug = (...args) => console.debug(...args)

const debugDisabled = () => {}

const info = (...args) => console.info(...args)

const infoDisabled = () => {}

const warn = (...args) => console.warn(...args)

const warnDisabled = () => {}

const error = (...args) => console.error(...args)

const errorDisabled = () => {}

const disabledMethods = {
  debug: debugDisabled,
  info: infoDisabled,
  warn: warnDisabled,
  error: errorDisabled,
}

export const loggerIsMethodEnabled = (logger, methodName) => {
  return logger[methodName] !== disabledMethods[methodName]
}

export const loggerToLevels = (logger) => {
  return {
    debug: loggerIsMethodEnabled(logger, "debug"),
    info: loggerIsMethodEnabled(logger, "info"),
    warn: loggerIsMethodEnabled(logger, "warn"),
    error: loggerIsMethodEnabled(logger, "error"),
  }
}

export const loggerToLogLevel = (logger) => {
  if (loggerIsMethodEnabled(logger, "debug")) return LOG_LEVEL_DEBUG
  if (loggerIsMethodEnabled(logger, "info")) return LOG_LEVEL_INFO
  if (loggerIsMethodEnabled(logger, "warn")) return LOG_LEVEL_WARN
  if (loggerIsMethodEnabled(logger, "error")) return LOG_LEVEL_ERROR
  return LOG_LEVEL_OFF
}
