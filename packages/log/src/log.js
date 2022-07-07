/*
 * see also https://github.com/vadimdemedes/ink
 */

import stringWidth from "string-width"
import ansiEscapes from "ansi-escapes"

import { spyStreamOutput } from "./internal/spy_stream_output.js"

export const createLog = ({
  stream = process.stdout,
  newLine = "after",
} = {}) => {
  const { columns = 80, rows = 24 } = stream

  const log = {
    onVerticalOverflow: () => {},
  }

  let lastOutput = ""
  let clearAttemptResult
  let streamOutputSpy = noopStreamSpy

  const getErasePreviousOutput = () => {
    // nothing to clear
    if (!lastOutput) {
      return ""
    }
    if (clearAttemptResult !== undefined) {
      return ""
    }

    const logLines = lastOutput.split(/\r\n|\r|\n/)
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
      clearAttemptResult = false
      log.onVerticalOverflow()
      return ""
    }

    clearAttemptResult = true
    return ansiEscapes.eraseLines(visualLineCount)
  }

  const spyStream = () => {
    if (stream === process.stdout) {
      const stdoutSpy = spyStreamOutput(process.stdout)
      const stderrSpy = spyStreamOutput(process.stderr)
      return () => {
        return stdoutSpy() + stderrSpy()
      }
    }
    return spyStreamOutput(stream)
  }

  const doWrite = (string) => {
    string = addNewLines(string, newLine)
    stream.write(string)
    lastOutput = string
    clearAttemptResult = undefined

    // We don't want to clear logs written by other code,
    // it makes output unreadable and might erase precious information
    // To detect this we put a spy on the stream.
    // The spy is required only if we actually wrote something in the stream
    // otherwise tryToClear() won't do a thing so spy is useless
    streamOutputSpy = string ? spyStream() : noopStreamSpy
  }

  const write = (string, outputFromOutside = streamOutputSpy()) => {
    if (!lastOutput) {
      doWrite(string)
      return
    }
    if (outputFromOutside) {
      // something else than this code has written in the stream
      // so we just write without clearing (append instead of replacing)
      doWrite(string)
    } else {
      doWrite(`${getErasePreviousOutput()}${string}`)
    }
  }

  const dynamicWrite = (callback) => {
    const outputFromOutside = streamOutputSpy()
    const string = callback({ outputFromOutside })
    return write(string, outputFromOutside)
  }

  const destroy = () => {
    if (streamOutputSpy) {
      streamOutputSpy() // this uninstalls the spy
      streamOutputSpy = null
      lastOutput = ""
    }
  }

  Object.assign(log, {
    write,
    dynamicWrite,
    destroy,
  })
  return log
}

const noopStreamSpy = () => ""

// could be inlined but vscode do not correctly
// expand/collapse template strings, so I put it at the bottom
const addNewLines = (string, newLine) => {
  if (newLine === "before") {
    return `
${string}`
  }
  if (newLine === "after") {
    return `${string}
`
  }
  if (newLine === "around") {
    return `
${string}
`
  }
  return string
}
