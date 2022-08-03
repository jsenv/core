// see also https://github.com/sindresorhus/figures

import isUnicodeSupported from "is-unicode-supported"

import { ANSI } from "./ansi.js"

const canUseUnicode = isUnicodeSupported()

const COMMAND_RAW = canUseUnicode ? `❯` : `>`
const OK_RAW = canUseUnicode ? `✔` : `√`
const FAILURE_RAW = canUseUnicode ? `✖` : `×`
const DEBUG_RAW = canUseUnicode ? `◆` : `♦`
const INFO_RAW = canUseUnicode ? `ℹ` : `i`
const WARNING_RAW = canUseUnicode ? `⚠` : `‼`
const CIRCLE_CROSS_RAW = canUseUnicode ? `ⓧ` : `(×)`

const COMMAND = ANSI.color(COMMAND_RAW, ANSI.GREY) // ANSI_MAGENTA)
const OK = ANSI.color(OK_RAW, ANSI.GREEN)
const FAILURE = ANSI.color(FAILURE_RAW, ANSI.RED)
const DEBUG = ANSI.color(DEBUG_RAW, ANSI.GREY)
const INFO = ANSI.color(INFO_RAW, ANSI.BLUE)
const WARNING = ANSI.color(WARNING_RAW, ANSI.YELLOW)
const CIRCLE_CROSS = ANSI.color(CIRCLE_CROSS_RAW, ANSI.RED)

export const UNICODE = {
  COMMAND,
  OK,
  FAILURE,
  DEBUG,
  INFO,
  WARNING,
  CIRCLE_CROSS,

  COMMAND_RAW,
  OK_RAW,
  FAILURE_RAW,
  DEBUG_RAW,
  INFO_RAW,
  WARNING_RAW,
  CIRCLE_CROSS_RAW,

  supported: canUseUnicode,
}
