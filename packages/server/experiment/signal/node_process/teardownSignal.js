import { Signal } from "../signal.js"

import { SIGTERMSignal } from "./SIGTERMSignal.js"
import { SIGINTSignal } from "./SIGINTSignal.js"
import { SIGHUPSignal } from "./SIGHUPSignal.js"
import { beforeExitSignal } from "./beforeExitSignal.js"
import { exitSignal } from "./exitSignal.js"

const signals = {
  SIGHUP: SIGHUPSignal,
  ...(process.platform === "win32" ? {} : { SIGTERM: SIGTERMSignal }),
  SIGINT: SIGINTSignal,
  beforeExit: beforeExitSignal,
  exit: exitSignal,
}

export const teardownSignal = Object.keys(signals).reduce(
  (previous, signalName) => {
    return Signal.composeTwoSignals(
      previous,
      Signal.map(signals[signalName], () => {
        return signalName
      }),
    )
  },
  Signal.DORMANT,
)
