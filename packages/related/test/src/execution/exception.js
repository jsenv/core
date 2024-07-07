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
import { URL_META } from "@jsenv/url-meta";

const isDev = process.execArgv.includes("--conditions=development");
const jsenvCoreDirectoryUrl = new URL("../../../../../", import.meta.url);

export const createException = (reason, { rootDirectoryUrl } = {}) => {
  const exception = {
    isException: true,
    isError: false,
    name: "",
    message: "",
    stack: "",
    stackTrace: "",
    stackFrames: undefined,
    site: null,
  };

  if (reason === undefined) {
    exception.message = "undefined";
    return exception;
  }
  if (reason === null) {
    exception.message = "null";
    return exception;
  }
  if (typeof reason === "string") {
    exception.message = reason;
    return exception;
  }
  if (typeof reason !== "object") {
    exception.message = JSON.stringify(reason);
    return exception;
  }
  if (reason.stackFrames === undefined && "stack" in reason) {
    let stackFrames;

    const { prepareStackTrace } = Error;
    Error.prepareStackTrace = (e, callSites) => {
      Error.prepareStackTrace = prepareStackTrace;

      stackFrames = [];
      for (const callSite of callSites) {
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
      }
      return "";
    };
    exception.stack = reason.stack;
    if (stackFrames === undefined) {
      // Error.prepareStackTrace not trigerred
      // - reason is not an error
      // - reason.stack already get
      Error.prepareStackTrace = prepareStackTrace;

      const calls = parseStackTrace(reason.stack);
      stackFrames = [];
      for (const call of calls) {
        if (call.fileName === "") {
          continue;
        }
        stackFrames.push({
          raw: call.raw,
          functionName: call.name,
          url: call.fileName,
          line: call.line,
          column: call.column,
          native: call.type === "native",
        });
      }
    }

    const stackFramesNonNative = [];
    for (const stackFrame of stackFrames) {
      if (!stackFrame.url) {
        continue;
      }
      if (stackFrame.url.startsWith("node:")) {
        stackFrame.native = "node";
        continue;
      }
      if (stackFrame.url.startsWith("file:")) {
        if (rootDirectoryUrl && stackFrame.url.startsWith(rootDirectoryUrl)) {
          stackFramesNonNative.push(stackFrame);
          continue;
        }

        if (isDev) {
          // while developing jsenv itself we want to exclude any
          // - src/*
          // - packages/**/src/
          // for the users of jsenv it's easier, we want to exclude
          // - **/node_modules/@jsenv/**
          if (
            URL_META.matches(stackFrame.url, {
              [`${jsenvCoreDirectoryUrl}src/`]: true,
              [`${jsenvCoreDirectoryUrl}packages/**/src/`]: true,
            })
          ) {
            stackFrame.native = "jsenv";
            continue;
          }
        } else if (
          URL_META.matches(stackFrame.url, {
            "file:///**/node_modules/@jsenv/core/": true,
          })
        ) {
          stackFrame.native = "jsenv";
          continue;
        }
      }
      stackFramesNonNative.push(stackFrame);
    }
    if (stackFramesNonNative.length) {
      stackFrames = stackFramesNonNative;
    }

    reason.stackFrames = stackFrames;

    let stackTrace = "";
    for (const stackFrame of stackFrames) {
      if (stackTrace) stackTrace += "\n";
      stackTrace += stackFrame.raw;
    }
    reason.stackTrace = stackTrace;
    let stack = "";
    const name = getErrorName(reason);
    const message = reason.message || "";
    stack += `${name}: ${message}`;
    if (stackTrace) {
      stack += `\n${stackTrace}`;
    }
    reason.stack = stack;

    const [firstCallFrame] = stackFrames;
    if (firstCallFrame && (!reason.site || !reason.site.isInline)) {
      reason.site = firstCallFrame.url
        ? {
            url: firstCallFrame.url,
            line: firstCallFrame.line,
            column: firstCallFrame.column,
          }
        : firstCallFrame.evalSite;
    }
  }
  // getOwnPropertyNames to catch non enumerable properties on reason
  // (happens mostly when reason is instanceof Error)
  // like .stack, .message
  // some properties are even on the prototype like .name
  for (const ownPropertyName of Object.getOwnPropertyNames(reason)) {
    exception[ownPropertyName] = reason[ownPropertyName];
  }
  const isError = reason instanceof Error;
  exception.isError = isError;
  if (isError) {
    // getOwnPropertyNames is not enough to copy .name and .message
    // on error instances
    exception.name = getErrorName(reason);
    exception.message = reason.message;
  }
  return exception;
};

const getErrorName = (value) => {
  const { constructor } = value;
  if (constructor) {
    if (constructor.name !== "Object") {
      return constructor.name;
    }
  }
  return value.name || "Error";
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
