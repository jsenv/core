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
import { URL_META } from "@jsenv/url-meta";
import { parseStackTrace } from "errorstacks";
import { pathToFileURL } from "node:url";

const isDev = process.execArgv.includes("--conditions=development");

export const createException = (
  reason,
  {
    jsenvCoreDirectoryUrl = new URL("../../../../", import.meta.url),
    rootDirectoryUrl,
    errorTransform = () => {},
  } = {},
) => {
  const exception = {
    runtime: "node",
    originalRuntime: "node",
    isException: true,
    isError: false,
    name: "",
    message: "",
    stackTrace: "",
    stack: "",
    stackFrames: undefined,
    site: null,
    ownProps: {},
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
  errorTransform(reason);
  const isError = reason instanceof Error;
  if (reason.isException) {
    if (isError) {
      // see "normalizeRuntimeError" in run.js
      for (const key of Object.getOwnPropertyNames(reason)) {
        exception[key] = reason[key];
      }
    } else {
      Object.assign(exception, reason);
    }
    if (reason.runtime === "browser") {
      const { stackFrames, stackTrace, stack, site } = getStackInfo(reason, {
        name: reason.name,
        rootDirectoryUrl,
        jsenvCoreDirectoryUrl,
      });
      exception.stackFrames = stackFrames;
      exception.stackTrace = stackTrace;
      exception.stack = stack;
      exception.site = site;
      exception.runtime = "node";
      exception.originalRuntime = "browser";
    }
    return exception;
  }
  exception.isError = isError;
  const name = getErrorName(reason, isError);
  if ("stack" in reason) {
    const { stackFrames, stackTrace, stack, site } = getStackInfo(reason, {
      name: reason.name,
      rootDirectoryUrl,
      jsenvCoreDirectoryUrl,
    });
    exception.stackFrames = stackFrames;
    exception.stackTrace = stackTrace;
    exception.stack = stack;
    exception.site = site;
  }
  // getOwnPropertyNames to catch non enumerable properties on reason
  // (happens mostly when reason is instanceof Error)
  // like .stack, .message
  // some properties are even on the prototype like .name
  const ownKeySet = new Set(Object.keys(reason));
  if (isError) {
    // getOwnPropertyNames is not enough to copy .name and .message
    // on error instances
    exception.name = name;
    exception.message = reason.message;
    ownKeySet.delete("__INTERNAL_ERROR__");
    ownKeySet.delete("name");
    ownKeySet.delete("message");
    ownKeySet.delete("stack");
    if (reason.cause) {
      ownKeySet.delete("cause");
      const causeException = createException(reason.cause, {
        jsenvCoreDirectoryUrl,
        rootDirectoryUrl,
        errorTransform,
      });
      exception.ownProps["[cause]"] = causeException;
    }
  }
  for (const ownKey of ownKeySet) {
    exception.ownProps[ownKey] = reason[ownKey];
  }
  return exception;
};

const getStackInfo = (
  reason,
  { name, rootDirectoryUrl, jsenvCoreDirectoryUrl },
) => {
  let stack;
  let stackFrames;
  if (reason.isException) {
    stack = reason.stack;
  } else {
    const { prepareStackTrace } = Error;
    Error.prepareStackTrace = (e, callSites) => {
      Error.prepareStackTrace = prepareStackTrace;
      stackFrames = [];
      for (const callSite of callSites) {
        const isNative = callSite.isNative();
        const stackFrame = {
          raw: `  at ${String(callSite)}`,
          url: asFileUrl(
            callSite.getFileName() || callSite.getScriptNameOrSourceURL(),
            { isNative },
          ),
          line: callSite.getLineNumber(),
          column: callSite.getColumnNumber(),
          functionName: callSite.getFunctionName(),
          isNative,
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
    stack = reason.stack;
    if (stackFrames === undefined) {
      // Error.prepareStackTrace not trigerred
      // - reason is not an error
      // - reason.stack already get
      Error.prepareStackTrace = prepareStackTrace;
    }
  }
  if (stackFrames === undefined) {
    if (reason.stackFrames) {
      stackFrames = reason.stackFrames;
    } else {
      const calls = parseStackTrace(stack);
      stackFrames = [];
      for (const call of calls) {
        if (call.fileName === "") {
          continue;
        }
        const isNative = call.type === "native";
        stackFrames.push({
          raw: call.raw,
          functionName: call.name,
          url: asFileUrl(call.fileName, { isNative }),
          line: call.line,
          column: call.column,
          isNative,
        });
      }
    }
  }
  if (reason.__INTERNAL_ERROR__) {
    stackFrames = [];
  } else {
    const stackFrameInternalArray = [];
    for (const stackFrame of stackFrames) {
      if (!stackFrame.url) {
        continue;
      }
      if (stackFrame.isNative) {
        stackFrame.category = "native";
        continue;
      }
      if (stackFrame.url.startsWith("node:")) {
        stackFrame.category = "node";
        continue;
      }
      if (!stackFrame.url.startsWith("file:")) {
        stackFrameInternalArray.push(stackFrame);
        continue;
      }
      if (rootDirectoryUrl && stackFrame.url.startsWith(rootDirectoryUrl)) {
        stackFrameInternalArray.push(stackFrame);
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
          stackFrame.category = "jsenv";
          continue;
        }
      } else if (
        URL_META.matches(stackFrame.url, {
          "file:///**/node_modules/@jsenv/core/": true,
        })
      ) {
        stackFrame.category = "jsenv";
        continue;
      }
      if (
        URL_META.matches(stackFrame.url, {
          "file:///**/node_modules/": true,
        })
      ) {
        stackFrame.category = "node_modules";
        continue;
      }
      stackFrameInternalArray.push(stackFrame);
    }
    if (stackFrameInternalArray.length) {
      stackFrames = stackFrameInternalArray;
    }
  }

  let stackTrace = "";
  for (const stackFrame of stackFrames) {
    if (stackTrace) stackTrace += "\n";
    stackTrace += stackFrame.raw;
  }

  stack = "";
  const message = reason.message || "";
  stack += `${name}: ${message}`;
  if (stackTrace) {
    stack += `\n${stackTrace}`;
  }

  let site;
  if (reason.stackFrames && reason.site && !reason.site.isInline) {
    site = reason.site;
  } else {
    const [firstCallFrame] = stackFrames;
    if (firstCallFrame) {
      site = firstCallFrame.url
        ? {
            url: firstCallFrame.url,
            line: firstCallFrame.line,
            column: firstCallFrame.column,
          }
        : firstCallFrame.evalSite;
    }
  }
  return { stackFrames, stackTrace, stack, site };
};

const asFileUrl = (callSiteFilename, { isNative }) => {
  if (isNative) {
    return callSiteFilename;
  }
  if (!callSiteFilename) {
    return callSiteFilename;
  }
  if (callSiteFilename.startsWith("file:")) {
    return callSiteFilename;
  }
  if (callSiteFilename.startsWith("node:")) {
    return callSiteFilename;
  }
  try {
    const fileUrl = pathToFileURL(callSiteFilename);
    return fileUrl.href;
  } catch (e) {
    return callSiteFilename;
  }
};

export const stringifyException = (exception) => {
  let string = "";

  if (exception.name) {
    string += `${exception.name}: ${exception.message}`;
  } else {
    string += exception.message;
  }
  if (exception.stackTrace) {
    string += `\n${exception.stackTrace}`;
  }
  const { ownProps } = exception;
  if (ownProps) {
    const ownPropsKeys = Object.keys(ownProps);
    if (ownPropsKeys.length > 0) {
      string += " {";
      const indentationLevel = 0;
      const indentation = "  ".repeat(indentationLevel);
      const indentationInsideObject = "  ".repeat(indentationLevel + 1);
      for (const key of Object.keys(ownProps)) {
        const value = ownProps[key];
        string += `\n${indentationInsideObject}`;
        string += `${key}: `;
        if (value && value.isException) {
          const valueString = stringifyException(value);
          const valueStringIndented = indentLines(
            valueString,
            indentationLevel + 1,
          );
          string += valueStringIndented;
        } else {
          string += JSON.stringify(value, null, indentationInsideObject);
        }
        string += ",";
      }
      string += `\n${indentation}}`;
    }
  }
  return string;
};

const indentLines = (text, level = 1) => {
  const lines = text.split(/\r?\n/);
  const indentation = "  ".repeat(level);
  const firstLine = lines.shift();
  let result = firstLine;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    i++;
    result += line.length ? `\n${indentation}${line}` : `\n`;
  }
  return result;
};

const getErrorName = (value, isError) => {
  const { constructor } = value;
  if (constructor) {
    const { name } = constructor;
    if (name !== "Object") {
      if (name === "Error" && isError && value.name !== "Error") {
        return value.name;
      }
      return name;
    }
  }
  return value.name || "Error";
};

const getPropertiesFromEvalOrigin = (origin) => {
  // Most eval() calls are in this format
  const topLevelEvalMatch = /^eval at [^(]+ \(.+:\d+:\d+\)$/.exec(origin);
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
  const nestedEvalMatch = /^eval at [^(]+ \(.+\)$/.exec(origin);
  if (nestedEvalMatch) {
    return getPropertiesFromEvalOrigin(nestedEvalMatch[2]);
  }
  return null;
};
