import { createSupportsColor } from "supports-color";

const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic;
let canUseColors = processSupportsBasicColor;

// GitHub workflow does support ANSI but "supports-color" returns false
// because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
if (process.env.GITHUB_WORKFLOW) {
  // Check on FORCE_COLOR is to ensure it is prio over GitHub workflow check
  if (process.env.FORCE_COLOR !== "false") {
    // in unit test we use process.env.FORCE_COLOR = 'false' to fake
    // that colors are not supported. Let it have priority
    canUseColors = true;
  }
}

// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const MAGENTA = "\x1b[35m";
const GREY = "\x1b[90m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const setANSIColor = canUseColors
  ? (text, ANSI_COLOR) => `${ANSI_COLOR}${text}${RESET}`
  : (text) => text;

const setANSIEffect = canUseColors
  ? (text, ANSI_EFFECT) => `${ANSI_EFFECT}${text}${RESET}`
  : (text) => text;

export const ANSI = {
  supported: canUseColors,

  color: setANSIColor,
  RED,
  GREEN,
  YELLOW,
  BLUE,
  MAGENTA,
  GREY,
  RESET,

  effect: setANSIEffect,
  BOLD,
};
