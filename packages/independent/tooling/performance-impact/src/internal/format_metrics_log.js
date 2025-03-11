import { formatMetricValue } from "./format_metric_value.js";

export const formatMetricsLog = (metrics) => {
  const metricsReadable = {};
  Object.keys(metrics).forEach((metricName) => {
    metricsReadable[metricName] = formatMetricValue(metrics[metricName]);
  });
  return JSON.stringify(metricsReadable, null, "  ");
};
