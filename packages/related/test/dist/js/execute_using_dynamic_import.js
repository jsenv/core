import { writeFileSync } from "node:fs";
import { memoryUsage } from "node:process";
import { Session } from "node:inspector";
import { PerformanceObserver, performance } from "node:perf_hooks";
import { createException } from "./exception.js";

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
  measureMemoryUsage,
  collectPerformance,
  coverageEnabled,
  coverageInclude,
  coverageMethodForNodeJs,
  coverageFileUrl,
}) => {
  const result = {
    timings: {
      origin: Date.now(),
      start: null,
      end: null,
    },
    errors: [],
    namespace: null,
    memoryUsage: null,
    performance: null,
  };

  let finalizePerformance;
  if (collectPerformance) {
    const getPerformance = startObservingPerformances();
    finalizePerformance = async () => {
      const performance = await getPerformance();
      result.performance = performance;
    };
  }

  let finalizeCoverage;
  if (coverageEnabled && coverageMethodForNodeJs === "Profiler") {
    const { stopJsCoverage } = await startJsCoverage();
    finalizeCoverage = async () => {
      const [coverage, { filterV8Coverage }] = await Promise.all([
        stopJsCoverage(),
        import("./v8_coverage.js"),
      ]);
      const coverageLight = await filterV8Coverage(coverage, {
        rootDirectoryUrl,
        coverageInclude,
      });
      writeFileSync(
        new URL(coverageFileUrl),
        JSON.stringify(coverageLight, null, "  "),
      );
    };
  }

  let finalizeMemoryUsage;
  if (measureMemoryUsage) {
    global.gc();
    const memoryHeapUsedBeforeExecution = memoryUsage().heapUsed;
    finalizeMemoryUsage = () => {
      global.gc();
      const memoryHeapUsedAfterExecution = memoryUsage().heapUsed;
      result.memoryUsage =
        memoryHeapUsedAfterExecution - memoryHeapUsedBeforeExecution;
    };
  }

  result.timings.start = Date.now() - result.timings.origin;
  try {
    const namespace = await import(fileUrl);
    const namespaceResolved = {};
    await Promise.all(
      Object.keys(namespace).map(async (key) => {
        const value = await namespace[key];
        namespaceResolved[key] = value;
      }),
    );
    result.status = "completed";
    result.namespace = namespaceResolved;
  } catch (e) {
    result.status = "failed";
    result.errors.push(createException(e, { rootDirectoryUrl }));
  } finally {
    result.timings.end = Date.now() - result.timings.origin;
    if (finalizeCoverage) {
      await finalizeCoverage();
      finalizeCoverage = null;
    }
    if (finalizePerformance) {
      await finalizePerformance();
      finalizePerformance = null;
    }
    if (finalizeMemoryUsage) {
      finalizeMemoryUsage();
      finalizeMemoryUsage = null;
    }
    return result;
  }
};

export { executeUsingDynamicImport };
