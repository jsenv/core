import { median } from "./median.js";

export const computeMetricsMedian = (metrics) => {
  const metricsMedian = {};

  Object.keys(metrics).forEach((metricName) => {
    const metricWithIteration = metrics[metricName];
    metricsMedian[metricName] = {
      value: median(metricWithIteration.values),
      unit: metricWithIteration.unit,
    };
  });

  return metricsMedian;
};
