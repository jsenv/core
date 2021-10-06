import readline from "readline"

import stringWidth from "string-width"
import { memoize } from "@jsenv/filesystem"

export const writeLog = (
  string,
  { mightUpdate = true, stream = process.stdout } = {},
) => {
  string = `${string}
`
  stream.write(string)

  const moveCursorToLineAbove = () => {
    readline.moveCursor(stream, 0, -1)
  }

  const clearCursorLine = () => {
    readline.clearLine(stream, 0)
  }

  const remove = memoize(() => {
    const { columns = 80, rows = 24 } = stream
    const logLines = string.split(/\r\n|\r|\n/)
    let visualLineCount = 0
    logLines.forEach((logLine) => {
      const width = stringWidth(logLine)
      visualLineCount += width === 0 ? 1 : Math.ceil(width / columns)
    })

    if (visualLineCount > rows) {
      // the whole log cannot be cleared because it's vertically to long
      // (longer than terminal height)
      // readline.moveCursor cannot move cursor higher than screen height
      // it means we would only clear the visible part of the log
      // better keep the log untouched
      return
    }

    while (visualLineCount--) {
      clearCursorLine()
      if (visualLineCount > 0) {
        moveCursorToLineAbove()
      }
    }
    // an other version of the while above could the code below
    // readline.moveCursor(stream, 0, -visualLineCount)
    // readline.clearScreenDown(stream)
  })

  if (mightUpdate) {
    const consoleModified = spyConsoleModification()

    let updated = false
    const update = (newString) => {
      if (updated) {
        console.warn(`cannot update twice`)
        return null
      }
      updated = true

      if (!consoleModified()) {
        remove()
      }
      return writeLog(newString, { stream })
    }

    return { remove, update }
  }

  return {
    remove,
    update: null,
  }
}

// maybe https://github.com/gajus/output-interceptor/tree/v3.0.0 ?
// the problem with listening data on stdout
// is that node.js will later throw error if stream gets closed
// while something listening data on it
const spyConsoleModification = () => {
  const { stdout, stderr } = process
  const originalStdoutWrite = stdout.write
  const originalStdErrWrite = stderr.write

  let modified = false

  stdout.write = function (...args /* chunk, encoding, callback */) {
    modified = true
    return originalStdoutWrite.call(stdout, ...args)
  }
  stderr.write = function (...args) {
    modified = true
    return originalStdErrWrite.call(stderr, ...args)
  }

  const uninstall = () => {
    stdout.write = originalStdoutWrite
    stderr.write = originalStdErrWrite
  }

  return () => {
    uninstall()
    return modified
  }
}
