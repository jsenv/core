import { createLog, startSpinner, UNICODE } from "@jsenv/log"

import { msAsDuration } from "@jsenv/utils/logs/duration_log.js"

export const createTaskLog = (label) => {
  const startMs = Date.now()
  const taskSpinner = startSpinner({
    log: createLog(),
    text: label,
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
    fail: () => {
      taskSpinner.stop(`${UNICODE.FAILURE} failed to ${label}`)
    },
  }
}
