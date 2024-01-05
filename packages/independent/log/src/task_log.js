import { inspectDuration } from "@jsenv/inspect";

import { UNICODE } from "./unicode.js";
import { createDynamicLog } from "./dynamic_log.js";
import { startSpinner } from "./spinner.js";

export const createTaskLog = (
  label,
  { disabled = false, animated = true, stopOnWriteFromOutside } = {},
) => {
  if (disabled) {
    return {
      setRightText: () => {},
      done: () => {},
      happen: () => {},
      fail: () => {},
    };
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
        `${UNICODE.OK} ${label} (done in ${inspectDuration(msEllapsed)})`,
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
