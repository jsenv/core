import { writeFileSync } from "node:fs";
import { memoryUsage } from "node:process";

import { startJsCoverage } from "./profiler_v8_coverage.js";
import { startObservingPerformances } from "./node_execution_performance.js";

export const executeUsingDynamicImport = async ({
  rootDirectoryUrl,
  fileUrl,
  measureMemoryUsage,
  collectPerformance,
  coverageEnabled,
  coverageConfig,
  coverageMethodForNodeJs,
  coverageFileUrl,
}) => {
  const result = {
    timings: {
      start: null,
      end: null,
    },
    memoryUsage: null,
    performance: null,
    namespace: null,
  };
  const afterImportCallbackSet = new Set();

  if (coverageEnabled && coverageMethodForNodeJs === "Profiler") {
    const { filterV8Coverage } = await import("../coverage/v8_coverage.js");
    const { stopJsCoverage } = await startJsCoverage();
    afterImportCallbackSet.add(async () => {
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
    afterImportCallbackSet.add(async () => {
      const performance = await getPerformance();
      result.performance = performance;
    });
  }
  let memoryUsageBeforeImport;
  if (measureMemoryUsage) {
    if (!global.gc) {
      const [v8, { runInNewContext }] = await Promise.all([
        import("node:v8"),
        import("node:vm"),
      ]);
      v8.setFlagsFromString("--expose_gc");
      global.gc = runInNewContext("gc");
    }
    global.gc();
    memoryUsageBeforeImport = memoryUsage();
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
    result.namespace = namespaceResolved;
  } finally {
    result.timings.end = Date.now();
    if (measureMemoryUsage) {
      global.gc();
      const memoryUsageAfterImport = memoryUsage();
      result.memoryUsage =
        memoryUsageAfterImport.heapUsed - memoryUsageBeforeImport.heapUsed;
    }
    for (const afterImportCallback of afterImportCallbackSet) {
      await afterImportCallback();
    }
    return result;
  }
};
