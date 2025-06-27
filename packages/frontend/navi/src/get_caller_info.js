export const getCallerInfo = () => {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_, stack) => stack;

    const error = new Error();
    const stack = error.stack;

    if (stack && stack.length > 2) {
      // stack[0] = getCallerInfo function
      // stack[1] = the method calling getCallerInfo (get, post, etc.)
      // stack[2] = actual caller (user code)
      const callerFrame = stack[2];

      return {
        file: callerFrame.getFileName(),
        line: callerFrame.getLineNumber(),
        column: callerFrame.getColumnNumber(),
        function: callerFrame.getFunctionName() || "<anonymous>",
        raw: callerFrame.toString(),
      };
    }

    return { raw: "unknown" };
  } finally {
    // ✅ Always restore original prepareStackTrace
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
};
