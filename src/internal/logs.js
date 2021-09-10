// TODO: move this inside ./logs/

import isUnicodeSupported from "is-unicode-supported"
import { createSupportsColor } from "supports-color"

const canUseUnicode = isUnicodeSupported()
const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic

console.log(processSupportsBasicColor)

export const ANSI_RED = "\x1b[31m"
export const ANSI_GREEN = "\x1b[32m"
export const ANSI_YELLOW = "\x1b[33m"
export const ANSI_BLUE = "\x1b[34m"
export const ANSI_MAGENTA = "\x1b[35m"
export const ANSI_GREY = "\x1b[39m"
export const ANSI_RESET = "\x1b[0m"

export const setANSIColor = processSupportsBasicColor
  ? (text, ansiColor) => `${ansiColor}${text}${ANSI_RESET}`
  : (text) => text

export const commandSign = setANSIColor(canUseUnicode ? `❯` : `>`, ANSI_GREY) // ANSI_MAGENTA)
export const okSign = setANSIColor(canUseUnicode ? `✔` : `√`, ANSI_GREEN)
export const failureSign = setANSIColor(canUseUnicode ? `✖` : `×`, ANSI_RED)
export const infoSign = setANSIColor(canUseUnicode ? `ℹ` : `i`, ANSI_BLUE)
export const warningSign = setANSIColor(canUseUnicode ? `⚠` : `‼`, ANSI_YELLOW)
