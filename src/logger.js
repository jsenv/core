export const createLogger = ({ logLevel = "log" }) => {
  if (logLevel === "trace") {
    return {
      logTrace,
      log,
      logWarning,
      logError,
    }
  }

  if (logLevel === "log") {
    return {
      logTrace: logTraceDisabled,
      log,
      logWarning,
      logError,
    }
  }

  if (logLevel === "warn") {
    return {
      logTrace: logTraceDisabled,
      log: logDisabled,
      logWarning,
      logError,
    }
  }

  if (logLevel === "error") {
    return {
      logTrace: logTraceDisabled,
      log: logDisabled,
      logWarning: logWarningDisabled,
      logError,
    }
  }

  if (logLevel === "off") {
    return {
      logTrace: logTraceDisabled,
      log: logDisabled,
      logWarning: logWarningDisabled,
      logError: logErrorDisabled,
    }
  }

  throw new Error(`unexpected logLevel.
logLevel: ${logLevel}
allowed log level: "trace", "log", "warn", "error", "off"`)
}

const logTrace = console.trace

const logTraceDisabled = () => {}

const log = console.log

const logDisabled = () => {}

const logWarning = console.warn

const logWarningDisabled = () => {}

const logError = console.error

const logErrorDisabled = () => {}
