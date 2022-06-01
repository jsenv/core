import { createLog, startSpinner, UNICODE, msAsDuration } from "@jsenv/log"

export const createTaskLog = (
  label,
  { disabled = false, stopOnWriteFromOutside } = {},
) => {
  if (disabled) {
    return {
      setRightText: () => {},
      done: () => {},
      happen: () => {},
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
    happen: (message) => {
      taskSpinner.stop(
        `${UNICODE.INFO} ${message} (at ${new Date().toLocaleTimeString()})`,
      )
    },
    fail: (message = `failed to ${label}`) => {
      taskSpinner.stop(`${UNICODE.FAILURE} ${message}`)
    },
  }
}
