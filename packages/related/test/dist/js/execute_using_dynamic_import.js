import { writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { PerformanceObserver, performance } from "node:perf_hooks";

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

const createException = (reason) => {
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
    const stackInfo = getStackInfo(reason);
    if (stackInfo) {
      const { stackTrace, stackObject } = stackInfo;
      exception.stackTrace = stackTrace;
      const [firstCallSite] = stackObject;
      writePropertiesFromCallSite(exception, firstCallSite);
    }
    exception.stack = reason.stack;
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

const getStackInfo = (reason) => {
  if (reason instanceof Error) {
    const { prepareStackTrace } = Error;
    let stackTrace;
    let stackObject;
    Error.prepareStackTrace = (e, secondArg) => {
      Error.prepareStackTrace = prepareStackTrace;
      stackObject = secondArg;
      stackTrace = secondArg.map((callSite) => `  at ${callSite}`).join("\n");
      const name = e.name || "Error";
      const message = e.message || "";
      let stack = `${name}: ${message}`;
      if (stackTrace) {
        stack += `\n${stackTrace}`;
      }
      return stack;
    };
    // eslint-disable-next-line no-unused-expressions
    reason.stack;
    if (stackTrace === undefined) {
      return null;
    }
    return {
      stackTrace,
      stackObject,
    };
  }
  return null;
};
const writePropertiesFromCallSite = (exception, callSite) => {
  const source = callSite.getFileName() || callSite.getScriptNameOrSourceURL();
  if (source) {
    const line = callSite.getLineNumber();
    const column = callSite.getColumnNumber() - 1;
    exception.site = {
      url: source,
      line,
      column,
    };
    return;
  }
  // Code called using eval() needs special handling
  if (callSite.isEval()) {
    const origin = callSite.getEvalOrigin();
    if (origin) {
      writePropertiesFromEvalOrigin(exception, origin);
    }
  }
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

/*
 * Calling Profiler.startPreciseCoverage DO NOT propagate to
 * subprocesses (new Worker or child_process.fork())
 * So the best solution remains NODE_V8_COVERAGE
 * This profiler strategy remains useful when:
 * - As fallback when NODE_V8_COVERAGE is not configured
 * - If explicitely enabled with coverageMethodForNodeJs: "Profiler"
 *   - Used by jsenv during automated tests about coverage
 *   - Anyone prefering this approach over NODE_V8_COVERAGE and assuming
 *     it will not fork subprocess or don't care if coverage is missed for this code
 * - https://v8.dev/blog/javascript-code-coverage#for-embedders
 * - https://github.com/nodejs/node/issues/28283
 * - https://vanilla.aslushnikov.com/?Profiler.startPreciseCoverage
 */


const startJsCoverage = async ({
  callCount = true,
  detailed = true,
} = {}) => {
  const session = new Session();
  session.connect();
  const postSession = (action, options) => {
    const promise = new Promise((resolve, reject) => {
      session.post(action, options, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
    return promise;
  };

  await postSession("Profiler.enable");
  await postSession("Profiler.startPreciseCoverage", { callCount, detailed });

  const takeJsCoverage = async () => {
    const coverage = await postSession("Profiler.takePreciseCoverage");
    return coverage;
  };

  const stopJsCoverage = async () => {
    const coverage = await takeJsCoverage();
    await postSession("Profiler.stopPreciseCoverage");
    await postSession("Profiler.disable");
    return coverage;
  };

  return {
    takeJsCoverage,
    stopJsCoverage,
  };
};

const startObservingPerformances = () => {
  const measureEntries = [];
  // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html
  const perfObserver = new PerformanceObserver(
    (
      // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceobserverentrylist
      list,
    ) => {
      const perfMeasureEntries = list.getEntriesByType("measure");
      measureEntries.push(...perfMeasureEntries);
    },
  );
  perfObserver.observe({
    entryTypes: ["measure"],
  });
  return async () => {
    // wait for node to call the performance observer
    await new Promise((resolve) => {
      setTimeout(resolve);
    });
    performance.clearMarks();
    perfObserver.disconnect();
    return {
      ...readNodePerformance(),
      measures: measuresFromMeasureEntries(measureEntries),
    };
  };
};

const readNodePerformance = () => {
  const nodePerformance = {
    nodeTiming: asPlainObject(performance.nodeTiming),
    timeOrigin: performance.timeOrigin,
    eventLoopUtilization: performance.eventLoopUtilization(),
  };
  return nodePerformance;
};

// remove getters that cannot be stringified
const asPlainObject = (objectWithGetters) => {
  const objectWithoutGetters = {};
  Object.keys(objectWithGetters).forEach((key) => {
    objectWithoutGetters[key] = objectWithGetters[key];
  });
  return objectWithoutGetters;
};

const measuresFromMeasureEntries = (measureEntries) => {
  const measures = {};
  // Sort to ensure measures order is predictable
  // It seems to be already predictable on Node 16+ but
  // it's not the case on Node 14.
  measureEntries.sort((a, b) => {
    return a.startTime - b.startTime;
  });
  measureEntries.forEach(
    (
      // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceentry
      perfMeasureEntry,
    ) => {
      measures[perfMeasureEntry.name] = perfMeasureEntry.duration;
    },
  );
  return measures;
};

const executeUsingDynamicImport = async ({
  rootDirectoryUrl,
  fileUrl,
  collectPerformance,
  coverageEnabled,
  coverageConfig,
  coverageMethodForNodeJs,
  coverageFileUrl,
}) => {
  const result = {};
  const afterImportCallbacks = [];
  if (coverageEnabled && coverageMethodForNodeJs === "Profiler") {
    const { filterV8Coverage } = await import("./v8_coverage.js").then(n => n.v8_coverage);
    const { stopJsCoverage } = await startJsCoverage();
    afterImportCallbacks.push(async () => {
      const coverage = await stopJsCoverage();
      const coverageLight = await filterV8Coverage(coverage, {
        rootDirectoryUrl,
        coverageConfig,
      });
      writeFileSync(
        new URL(coverageFileUrl),
        JSON.stringify(coverageLight, null, "  "),
      );
    });
  }
  if (collectPerformance) {
    const getPerformance = startObservingPerformances();
    afterImportCallbacks.push(async () => {
      const performance = await getPerformance();
      result.performance = performance;
    });
  }
  const namespace = await import(fileUrl);
  const namespaceResolved = {};
  await Promise.all(
    Object.keys(namespace).map(async (key) => {
      const value = await namespace[key];
      namespaceResolved[key] = value;
    }),
  );
  result.namespace = namespaceResolved;
  await afterImportCallbacks.reduce(async (previous, afterImportCallback) => {
    await previous;
    await afterImportCallback();
  }, Promise.resolve());
  return result;
};

export { createException, executeUsingDynamicImport };
