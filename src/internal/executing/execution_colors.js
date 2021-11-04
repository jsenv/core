import { ANSI } from "@jsenv/log"

export const EXECUTION_COLORS = {
  aborted: ANSI.MAGENTA,
  timedout: ANSI.YELLOW,
  errored: ANSI.RED,
  completed: ANSI.GREEN,
  cancelled: ANSI.GREY,
}
