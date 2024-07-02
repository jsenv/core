// https://github.com/Marak/colors.js/blob/master/lib/styles.js
// https://stackoverflow.com/a/75985833/2634179
const RESET = "\x1b[0m";

export const ANSI = {
  supported: true,

  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  GREY: "\x1b[90m",
  color: (text, ANSI_COLOR) => {
    return ANSI.supported && ANSI_COLOR ? `${ANSI_COLOR}${text}${RESET}` : text;
  },

  BOLD: "\x1b[1m",
  UNDERLINE: "\x1b[4m",
  STRIKE: "\x1b[9m",
  effect: (text, ANSI_EFFECT) => {
    return ANSI.supported && ANSI_EFFECT
      ? `${ANSI_EFFECT}${text}${RESET}`
      : text;
  },
};
