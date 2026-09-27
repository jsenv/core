import { humanizeDuration } from "../time/time.js";
import { UNICODE } from "../unicode/unicode_node.js";
import { createDynamicLog } from "./dynamic_log.js";
import { startSpinner } from "./spinner.js";

export const createTaskLog = (
  label,
  // animated defaults to what the spinner decides: only when stdout is a terminal
  { disabled = false, animated, stopOnWriteFromOutside } = {},
) => {
  if (disabled) {
    return {
      setRightText: () => {},
      done: () => {},
      happen: () => {},
      fail: () => {},
    };
  }
  if (process.env.CAPTURING_SIDE_EFFECTS) {
    animated = false;
  }
  const startMs = Date.now();
  const dynamicLog = createDynamicLog();
  let message = label;
  const taskSpinner = startSpinner({
    dynamicLog,
    render: () => message,
    stopOnWriteFromOutside,
    animated,
  });
  return {
    setRightText: (value) => {
      message = `${label} ${value}`;
    },
    done: () => {
      const msEllapsed = Date.now() - startMs;
      taskSpinner.stop(
        `${UNICODE.OK} ${label} (done in ${humanizeDuration(msEllapsed)})`,
      );
    },
    happen: (message) => {
      taskSpinner.stop(
        `${UNICODE.INFO} ${message} (at ${new Date().toLocaleTimeString()})`,
      );
    },
    fail: (message = `failed to ${label}`) => {
      taskSpinner.stop(`${UNICODE.FAILURE} ${message}`);
    },
  };
};
