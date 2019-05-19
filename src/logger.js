export const LOG_LEVEL_OFF = "off"
export const LOG_LEVEL_ERRORS = "errors"
export const LOG_LEVEL_ERRORS_AND_WARNINGS = "errors+warnings"
export const LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS = "errors+warnings+logs"
export const LOG_LEVEL_MAXIMUM = "maximum"

export const createLogger = ({ logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS }) => {
  if (logLevel === LOG_LEVEL_MAXIMUM) {
    return {
      logTrace,
      log,
      logWarning,
      logError,
    }
  }

  if (logLevel === LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS) {
    return {
      logTrace: logTraceDisabled,
      log,
      logWarning,
      logError,
    }
  }

  if (logLevel === LOG_LEVEL_ERRORS_AND_WARNINGS) {
    return {
      logTrace: logTraceDisabled,
      log: logDisabled,
      logWarning,
      logError,
    }
  }

  if (logLevel === LOG_LEVEL_ERRORS) {
    return {
      logTrace: logTraceDisabled,
      log: logDisabled,
      logWarning: logWarningDisabled,
      logError,
    }
  }

  if (logLevel === LOG_LEVEL_OFF) {
    return {
      logTrace: logTraceDisabled,
      log: logDisabled,
      logWarning: logWarningDisabled,
      logError: logErrorDisabled,
    }
  }

  throw new Error(`unexpected logLevel.
logLevel: ${logLevel}
allowed log levels: ${LOG_LEVEL_OFF}, ${LOG_LEVEL_ERRORS}, ${LOG_LEVEL_ERRORS_AND_WARNINGS}, ${LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS}, ${LOG_LEVEL_MAXIMUM}`)
}

const logTrace = console.trace

const logTraceDisabled = () => {}

const log = console.log

const logDisabled = () => {}

const logWarning = console.warn

const logWarningDisabled = () => {}

const logError = console.error

const logErrorDisabled = () => {}
