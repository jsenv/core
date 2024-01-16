import { createSupportsColor } from "supports-color";

const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic;
// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";

export const ANSI = {
  supported: processSupportsBasicColor,

  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  GREY: "\x1b[90m",
  color: (text, ANSI_COLOR) => {
    return ANSI.supported ? `${ANSI_COLOR}${text}${RESET}` : text;
  },

  BOLD: "\x1b[1m",
  effect: (text, ANSI_EFFECT) => {
    return ANSI.supported ? `${ANSI_EFFECT}${text}${RESET}` : text;
  },
};

// GitHub workflow does support ANSI but "supports-color" returns false
// because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
if (
  process.env.GITHUB_WORKFLOW &&
  // Check on FORCE_COLOR is to ensure it is prio over GitHub workflow check
  // in unit test we use process.env.FORCE_COLOR = 'false' to fake
  // that colors are not supported. Let it have priority
  process.env.FORCE_COLOR !== "false"
) {
  ANSI.supported = true;
}
