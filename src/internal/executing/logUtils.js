// https://github.com/yarnpkg/yarn/blob/master/src/reporters/console/util.js
// https://github.com/yarnpkg/yarn/blob/master/src/reporters/console/progress-bar.js
// https://github.com/sindresorhus/log-update/blob/master/index.js
// see https://github.com/jsenv/jsenv-core/issues/59
import readline from "readline"
import tty from "tty"
import { require } from "../require.js"

const { supportsColor } = require("supports-color")

const CLEAR_WHOLE_LINE = 0

export const clearLine = (stdout = process.stdout) => {
  if (supportsColor(stdout)) {
    readline.clearLine(stdout, CLEAR_WHOLE_LINE)
    readline.cursorTo(stdout, 0)
  } else if (stdout instanceof tty.WriteStream) {
    if (stdout.columns > 0) {
      stdout.write(`\r${" ".repeat(stdout.columns - 1)}`)
    }
    stdout.write(`\r`)
  }
}

export const toStartOfLine = (stdout = process.stdout) => {
  if (supportsColor(stdout)) {
    readline.cursorTo(stdout, 0)
  } else {
    stdout.write("\r")
  }
}
