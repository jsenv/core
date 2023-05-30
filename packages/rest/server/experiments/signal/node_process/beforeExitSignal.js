import { Signal } from "../signal.js";

export const beforeExitSignal = Signal.from((callback) => {
  process.once("beforeExit", callback);
  return () => {
    process.removeListener("beforeExit", callback);
  };
});
