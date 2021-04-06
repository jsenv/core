import { require } from "../require.js"

const { supportsColor } = require("supports-color")

export const cross = "☓" // "\u2613"
export const checkmark = "✔" // "\u2714"

export const yellow = "\x1b[33m"
export const magenta = "\x1b[35m"
export const red = "\x1b[31m"
export const green = "\x1b[32m"
export const grey = "\x1b[39m"
export const ansiResetSequence = "\x1b[0m"

const processSupportsBasicColor = supportsColor(process.stdout).hasBasic

export const setANSIColor = processSupportsBasicColor
  ? (text, color) => `${color}${text}${ansiResetSequence}`
  : (text) => text
