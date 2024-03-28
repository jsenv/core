// see also https://github.com/sindresorhus/figures

import isUnicodeSupported from "is-unicode-supported";

import { ANSI } from "./ansi.js";

export const UNICODE = {
  supported: isUnicodeSupported(),

  get COMMAND_RAW() {
    return UNICODE.supported ? `❯` : `>`;
  },
  get OK_RAW() {
    return UNICODE.supported ? `✔` : `√`;
  },
  get FAILURE_RAW() {
    return UNICODE.supported ? `✖` : `×`;
  },
  get DEBUG_RAW() {
    return UNICODE.supported ? `◆` : `♦`;
  },
  get INFO_RAW() {
    return UNICODE.supported ? `ℹ` : `i`;
  },
  get WARNING_RAW() {
    return UNICODE.supported ? `⚠` : `‼`;
  },
  get CIRCLE_CROSS_RAW() {
    return UNICODE.supported ? `ⓧ` : `(×)`;
  },
  get COMMAND() {
    return ANSI.color(UNICODE.COMMAND_RAW, ANSI.GREY); // ANSI_MAGENTA)
  },
  get OK() {
    return ANSI.color(UNICODE.OK_RAW, ANSI.GREEN);
  },
  get FAILURE() {
    return ANSI.color(UNICODE.FAILURE_RAW, ANSI.RED);
  },
  get DEBUG() {
    return ANSI.color(UNICODE.DEBUG_RAW, ANSI.GREY);
  },
  get INFO() {
    return ANSI.color(UNICODE.INFO_RAW, ANSI.BLUE);
  },
  get WARNING() {
    return ANSI.color(UNICODE.WARNING_RAW, ANSI.YELLOW);
  },
  get CIRCLE_CROSS() {
    return ANSI.color(UNICODE.CIRCLE_CROSS_RAW, ANSI.RED);
  },
  get ELLIPSIS() {
    return UNICODE.supported ? `…` : `...`;
  },
};
