import isUnicodeSupported from "is-unicode-supported"
import { createSupportsColor } from "supports-color"

const canUseUnicode = isUnicodeSupported()
const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic
let canUseColors = processSupportsBasicColor

// GitHub workflow does support ANSI but "supports-color" returns false
// because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
if (process.env.GITHUB_WORKFLOW) {
  // Check on FORCE_COLOR is to ensure it is prio over GitHub workflow check
  if (process.env.FORCE_COLOR !== "false") {
    // in unit test we use process.env.FORCE_COLOR = 'false' to fake
    // that colors are not supported. Let it have priority
    canUseColors = true
  }
}

const ansiStyles = {
  red: { open: 31, close: 39 },
  green: { open: 32, close: 39 },
  yellow: { open: 33, close: 39 },
  blue: { open: 34, close: 39 },
  magenta: { open: 35, close: 39 },
  grey: { open: 39, close: 39 },
}

export const ANSI_RED = ansiStyles.red
export const ANSI_GREEN = ansiStyles.green
export const ANSI_YELLOW = ansiStyles.yellow
export const ANSI_BLUE = ansiStyles.blue
export const ANSI_MAGENTA = ansiStyles.magenta
export const ANSI_GREY = ansiStyles.grey

export const ANSI_RESET = "\x1b[0m"

export const setANSIColor = canUseColors
  ? (text, ansiColor) =>
      `\x1b[${ansiColor.open}m${text}\x1b[${ansiColor.close}m`
  : (text) => text

export const commandSignDefault = canUseUnicode ? `❯` : `>`
export const okSignDefault = canUseUnicode ? `✔` : `√`
export const failureSignDefault = canUseUnicode ? `✖` : `×`
export const infoSignDefault = canUseUnicode ? `ℹ` : `i`
export const warningSignDefault = canUseUnicode ? `⚠` : `‼`

export const commandSign = setANSIColor(commandSignDefault, ANSI_GREY) // ANSI_MAGENTA)
export const okSign = setANSIColor(okSignDefault, ANSI_GREEN)
export const failureSign = setANSIColor(failureSignDefault, ANSI_RED)
export const infoSign = setANSIColor(infoSignDefault, ANSI_BLUE)
export const warningSign = setANSIColor(warningSignDefault, ANSI_YELLOW)
