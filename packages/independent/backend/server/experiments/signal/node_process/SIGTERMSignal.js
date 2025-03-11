/*
 * SIGTERM: http://man7.org/linux/man-pages/man7/signal.7.html
 */

import { Signal } from "../signal.js";

export const SIGTERMSignal = Signal.from((sigterm) => {
  if (process.platform === "win32") {
    console.warn(`SIGTERM is not supported on windows`);
    return () => {};
  }

  process.once("SIGTERM", sigterm);
  return () => {
    process.removeListener("SIGTERM", sigterm);
  };
});
