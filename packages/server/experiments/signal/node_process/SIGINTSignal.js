/*
 * SIGINT is CTRL+C from keyboard also refered as keyboard interruption
 * http://man7.org/linux/man-pages/man7/signal.7.html
 * may also be sent by vscode https://github.com/Microsoft/vscode-node-debug/issues/1#issuecomment-405185642
 */

import { Signal } from "../signal.js"

export const SIGINTSignal = Signal.from((sigint) => {
  process.once("SIGINT", sigint)
  return () => {
    process.removeListener("SIGINT", sigint)
  }
})
