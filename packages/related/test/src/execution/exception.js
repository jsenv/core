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

// https://github.com/marvinhagemeister/errorstacks/tree/main
// https://cdn.jsdelivr.net/npm/errorstacks@latest/dist/esm/index.mjs
import { parseStackTrace } from "errorstacks";

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
  if (reason.isException) {
    return reason;
  }
  if (Object.hasOwn(reason, "stack")) {
    exception.isError = true;
    exception.name = reason.name;
    exception.message = reason.message;
    const { prepareStackTrace } = Error;
    Error.prepareStackTrace = (e, callSites) => {
      Error.prepareStackTrace = prepareStackTrace;

      const stackFrames = [];
      let stackTrace = "";
      for (const callSite of callSites) {
        if (stackTrace) stackTrace += "\n";
        const stackFrame = {
          raw: `  at ${String(callSite)}`,
          url: callSite.getFileName() || callSite.getScriptNameOrSourceURL(),
          line: callSite.getLineNumber(),
          column: callSite.getColumnNumber(),
          functionName: callSite.getFunctionName(),
          isNative: callSite.isNative(),
          isEval: callSite.isEval(),
          isConstructor: callSite.isConstructor(),
          isAsync: callSite.isAsync(),
          evalSite: null,
        };
        if (stackFrame.isEval) {
          const evalOrigin = stackFrame.getEvalOrigin();
          if (evalOrigin) {
            stackFrame.evalSite = getPropertiesFromEvalOrigin(evalOrigin);
          }
        }

        stackFrames.push(stackFrame);
        stackTrace += stackFrame.raw;
      }
      exception.stackFrames = stackFrames;
      exception.stackTrace = stackTrace;

      const name = e.name || "Error";
      const message = e.message || "";
      let stack = ``;
      stack += `${name}: ${message}`;
      if (stackTrace) {
        stack += `\n${stackTrace}`;
      }
      return stack;
    };
    exception.stack = reason.stack;
    if (exception.stackFrames === undefined) {
      // Error.prepareStackTrace not trigerred
      // - reason is not an error
      // - reason.stack already get
      Error.prepareStackTrace = prepareStackTrace;

      const calls = parseStackTrace(reason.stack);
      const stackFrames = [];
      for (const call of calls) {
        stackFrames.push({
          raw: call.raw,
          functionName: call.name,
          url: call.fileName,
          line: call.line,
          column: call.column,
          native: call.type === "native",
        });
      }
      exception.stackFrames = stackFrames;
    }

    const [firstCallFrame] = exception.stackFrames;
    if (firstCallFrame) {
      exception.site = firstCallFrame.url
        ? {
            url: firstCallFrame.url,
            line: firstCallFrame.line,
            column: firstCallFrame.column,
          }
        : firstCallFrame.evalSite;
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

const getPropertiesFromEvalOrigin = (origin) => {
  // Most eval() calls are in this format
  const topLevelEvalMatch = /^eval at ([^(]+) \((.+):(\d+):(\d+)\)$/.exec(
    origin,
  );
  if (topLevelEvalMatch) {
    const source = topLevelEvalMatch[2];
    const line = Number(topLevelEvalMatch[3]);
    const column = topLevelEvalMatch[4] - 1;
    return {
      url: source,
      line,
      column,
    };
  }
  // Parse nested eval() calls using recursion
  const nestedEvalMatch = /^eval at ([^(]+) \((.+)\)$/.exec(origin);
  if (nestedEvalMatch) {
    return getPropertiesFromEvalOrigin(nestedEvalMatch[2]);
  }
  return null;
};
