import {
  ANSI_GREY,
  ANSI_YELLOW,
  ANSI_RED,
  ANSI_GREEN,
  ANSI_MAGENTA,
} from "../logs/log_style.js"

export const EXECUTION_COLORS = {
  aborted: ANSI_MAGENTA,
  timedout: ANSI_YELLOW,
  errored: ANSI_RED,
  completed: ANSI_GREEN,
  cancelled: ANSI_GREY,
}
