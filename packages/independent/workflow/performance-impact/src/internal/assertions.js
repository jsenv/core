import { createDetailedMessage } from "@jsenv/humanize";

export const assertPerformanceReport = (performanceReport) => {
  if (typeof performanceReport !== "object" || performanceReport === null) {
    throw new TypeError(
      `performanceReport must be an object, received ${performanceReport}.`,
    );
  }

  Object.keys(performanceReport).forEach((groupName) => {
    const metrics = performanceReport[groupName];
    assertMetrics(metrics);
  });
};

export const assertMetrics = (metrics, metricsTrace) => {
  if (typeof metrics !== "object" || metrics === null) {
    throw new TypeError(
      createDetailedMessage(`metrics must be an object, got ${metrics}`, {
        "metrics trace": metricsTrace,
      }),
    );
  }

  Object.keys(metrics).forEach((metricName) => {
    const metric = metrics[metricName];
    if (typeof metric !== "object") {
      throw new TypeError(
        `metric must be an object, got ${metric} for ${metricName}`,
      );
    }

    const { value } = metric;
    if (typeof value !== "number") {
      throw new TypeError(
        `metric value must be a number, got ${value} for ${metricName}`,
      );
    }

    const { unit } = metric;
    if (unit !== undefined && unit !== "ms" && unit !== "byte") {
      throw new TypeError(
        `metric type must be undefined, "ms", or "byte", got ${unit} for ${metricName}`,
      );
    }
  });
};
