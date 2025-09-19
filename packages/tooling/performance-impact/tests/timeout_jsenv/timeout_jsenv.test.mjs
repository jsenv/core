import { computeMetricsMedian } from "@jsenv/performance-impact/src/internal/compute_metrics_median.js";
import { measureMultipleTimes } from "@jsenv/performance-impact/src/internal/measure_multiple_times.js";
import { execute, nodeWorkerThread } from "@jsenv/test";

const rootDirectoryUrl = new URL("./", import.meta.url);

const measureFilePerformance = async (params) => {
  const executionResult = await execute({
    runtime: nodeWorkerThread(),
    ...params,
    // measurePerformance: true,
    collectPerformance: true,
  });
  const { measures } = executionResult.performance;
  const metrics = {};
  Object.keys(measures).forEach((measureName) => {
    metrics[measureName] = { value: measures[measureName], unit: "ms" };
  });
  return metrics;
};

const metrics = await measureMultipleTimes(() => {
  return measureFilePerformance({
    rootDirectoryUrl,
    fileRelativeUrl: "file.mjs",
  });
});

computeMetricsMedian(metrics);
// console.log(metrics, median);
