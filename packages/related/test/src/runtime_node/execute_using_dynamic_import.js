import { writeFileSync } from "node:fs";
import { memoryUsage } from "node:process";

import { startJsCoverage } from "./profiler_v8_coverage.js";
import { startObservingPerformances } from "./node_execution_performance.js";
import { createException } from "../execution/exception.js";

export const executeUsingDynamicImport = async ({
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
        import("../coverage/v8_coverage.js"),
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

  result.timings.start = Date.now();
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
    result.timings.end = Date.now();
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
