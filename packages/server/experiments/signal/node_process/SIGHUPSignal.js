/*
 * SIGHUP stands for Signal Hang UP.
 * It happens when process gets unresponsive or dies
 * SIGHUP http://man7.org/linux/man-pages/man7/signal.7.html
 */

import { Signal } from "../signal.js"

export const SIGHUPSignal = Signal.from((sighup) => {
  process.once("SIGHUP", sighup)
  return () => {
    process.removeListener("SIGHUP", sighup)
  }
})
