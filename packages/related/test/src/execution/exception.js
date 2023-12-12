/*
 * Exception are objects used to wrap a value that is thrown
 * Usually they wrap error but the value can be anything as
 * throw "toto" can be used in JS
 *
 * - provide a common API to interact with value that can be thrown
 * - enrich usual errors with a bit more information (line, column)
 * - normalize error properties
 *   - exception.stackTrace: only the stack trace as string (no error.name or error.message)
 *   - error.stack: error.name + error.message + error.stackTrace
 *
 * It is used mostly internally by jsenv but can also be found
 * value returned by "executeTestPlan" public export (for failed executions)
 * and value returned by "execute" public export (when execution fails)
 *
 * This file is responsible to wrap error hapenning in Node.js runtime
 * The browser part can be found in "supervisor.js"
 */

export const createException = (reason) => {
  const exception = {
    isException: true,
    isError: false,
    name: "",
    message: "",
    stack: "",
    stackTrace: "",
    site: null,
  };

  if (reason === undefined) {
    exception.message = "undefined";
    return exception;
  }
  if (reason === undefined) {
    exception.message = "undefined";
    return exception;
  }
  if (typeof reason === "string") {
    exception.message = reason;
    return exception;
  }
  if (reason instanceof Error) {
    exception.isError = true;
    exception.name = reason.name;
    exception.message = reason.message;

    if (reason instanceof Error) {
      const { prepareStackTrace } = Error;
      Error.prepareStackTrace = (e, callSites) => {
        Error.prepareStackTrace = prepareStackTrace;

        const [firstCallSite] = callSites;
        if (firstCallSite) {
          const source =
            firstCallSite.getFileName() ||
            firstCallSite.getScriptNameOrSourceURL();
          if (source) {
            const line = firstCallSite.getLineNumber();
            const column = firstCallSite.getColumnNumber() - 1;
            exception.site = {
              url: source,
              line,
              column,
            };
          }
          // Code called using eval() needs special handling
          else if (firstCallSite.isEval()) {
            const origin = firstCallSite.getEvalOrigin();
            if (origin) {
              writePropertiesFromEvalOrigin(exception, origin);
            }
          }
        }

        let stackTrace = "";
        for (const callSite of callSites) {
          if (stackTrace) stackTrace += "\n";
          const callSiteAsString = String(callSite);
          stackTrace += `  at ${callSiteAsString}`;
        }
        exception.stackTrace = stackTrace;

        const name = e.name || "Error";
        const message = e.message || "";
        let stack = ``;
        stack += `${name}: ${message}`;
        if (stackTrace) {
          stack += `\n${stackTrace}`;
        }
        exception.stack = stack;
        return stack;
      };
      // eslint-disable-next-line no-unused-expressions
      reason.stack;
      return exception;
    }
    return exception;
  }
  if (typeof reason === "object") {
    exception.code = reason.code;
    exception.message = reason.message;
    exception.stack = reason.stack;
    return exception;
  }
  exception.message = JSON.stringify(reason);
  return exception;
};

const writePropertiesFromEvalOrigin = (exception, origin) => {
  // Most eval() calls are in this format
  const topLevelEvalMatch = /^eval at ([^(]+) \((.+):(\d+):(\d+)\)$/.exec(
    origin,
  );
  if (topLevelEvalMatch) {
    const source = topLevelEvalMatch[2];
    const line = Number(topLevelEvalMatch[3]);
    const column = topLevelEvalMatch[4] - 1;
    exception.site = {
      url: source,
      line,
      column,
    };
    return;
  }
  // Parse nested eval() calls using recursion
  const nestedEvalMatch = /^eval at ([^(]+) \((.+)\)$/.exec(origin);
  if (nestedEvalMatch) {
    writePropertiesFromEvalOrigin(exception, nestedEvalMatch[2]);
  }
};
