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

export const ANSI_RED = "\x1b[31m"
export const ANSI_GREEN = "\x1b[32m"
export const ANSI_YELLOW = "\x1b[33m"
export const ANSI_BLUE = "\x1b[34m"
export const ANSI_MAGENTA = "\x1b[35m"
export const ANSI_GREY = "\x1b[39m"
export const ANSI_RESET = "\x1b[0m"

export const setANSIColor = canUseColors
  ? (text, ANSI_COLOR) => `${ANSI_COLOR}${text}${ANSI_RESET}`
  : (text) => text

export const commandSignColorLess = canUseUnicode ? `❯` : `>`
export const okSignColorLess = canUseUnicode ? `✔` : `√`
export const failureSignColorLess = canUseUnicode ? `✖` : `×`

export const commandSign = setANSIColor(commandSignColorLess, ANSI_GREY) // ANSI_MAGENTA)
export const okSign = setANSIColor(okSignColorLess, ANSI_GREEN)
export const failureSign = setANSIColor(failureSignColorLess, ANSI_RED)
export const infoSign = setANSIColor(canUseUnicode ? `ℹ` : `i`, ANSI_BLUE)
export const warningSign = setANSIColor(canUseUnicode ? `⚠` : `‼`, ANSI_YELLOW)
