import { computeMetricsMedian } from "@jsenv/performance-impact/src/internal/compute_metrics_median.js";
import { measureMultipleTimes } from "@jsenv/performance-impact/src/internal/measure_multiple_times.js";

export const generatePerformanceReport = async () => {
  const oneTimeout = await measureOneTimeout();

  const twoTimeouts = computeMetricsMedian(
    await measureMultipleTimes(measureTwoTimeouts, 5),
  );

  return {
    groups: {
      "setTimeout metrics": {
        ...oneTimeout,
        ...twoTimeouts,
      },
    },
  };
};

const measureOneTimeout = async () => {
  return {
    "with 100": {
      type: "duration",
      value: await measureATimeoutDuration(100),
    },
  };
};

// this will happen when code use multiple performance.measure
// we will receive an object representing each measures
const measureTwoTimeouts = async () => {
  const [durationFor100MsTimeout, durationFor200MsTimeout] = await Promise.all([
    measureATimeoutDuration(200),
    measureATimeoutDuration(400),
  ]);

  return {
    "with 200": { type: "duration", value: durationFor100MsTimeout },
    "with 400": { type: "duration", value: durationFor200MsTimeout },
  };
};

const measureATimeoutDuration = async (ms) => {
  const startTime = Date.now();
  let endTime;

  await new Promise((resolve) => {
    setTimeout(() => {
      endTime = Date.now();
      resolve();
    }, ms);
  });

  return endTime - startTime;
};
