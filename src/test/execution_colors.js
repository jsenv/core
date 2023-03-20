import { ANSI } from "@jsenv/log"

export const EXECUTION_COLORS = {
  executing: ANSI.BLUE,
  aborted: ANSI.MAGENTA,
  timedout: ANSI.MAGENTA,
  failed: ANSI.RED,
  completed: ANSI.GREEN,
  cancelled: ANSI.GREY,
}
