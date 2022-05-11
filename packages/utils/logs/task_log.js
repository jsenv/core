import { createLog, startSpinner, UNICODE } from "@jsenv/log"
import { loggerToLevels } from "@jsenv/logger"

import { msAsDuration } from "@jsenv/utils/logs/duration_log.js"

export const createTaskLog = (
  logger,
  label,
  { stopOnWriteFromOutside } = {},
) => {
  if (!loggerToLevels(logger).info) {
    return {
      setRightText: () => {},
      done: () => {},
      fail: () => {},
    }
  }
  const startMs = Date.now()
  const taskSpinner = startSpinner({
    log: createLog(),
    text: label,
    stopOnWriteFromOutside,
  })
  return {
    setRightText: (value) => {
      taskSpinner.text = `${label} ${value}`
    },
    done: () => {
      const msEllapsed = Date.now() - startMs
      taskSpinner.stop(
        `${UNICODE.OK} ${label} (done in ${msAsDuration(msEllapsed)})`,
      )
    },
    fail: (message = `failed to ${label}`) => {
      taskSpinner.stop(`${UNICODE.FAILURE} ${message}`)
    },
  }
}
