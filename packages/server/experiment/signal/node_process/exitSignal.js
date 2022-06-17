import { Signal } from "../signal.js"

export const exitSignal = Signal.from((exit) => {
  process.on("exit", exit)
  return () => {
    process.removeListener("exit", exit)
  }
})
