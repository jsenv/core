import { createDetailedMessage } from "@jsenv/humanize";
import { assertMetrics } from "./assertions.js";

export const measureMultipleTimes = async (
  measure,
  iterationCount = 5,
  { msToWaitBetweenEachIteration = 0 } = {},
) => {
  if (typeof measure !== "function") {
    throw new TypeError(`measure must be a function, received ${measure}`);
  }
  if (typeof iterationCount !== "number") {
    throw new TypeError(
      `iterationCount must be a number, received ${iterationCount}`,
    );
  }

  const firstIterationMetrics = await measure();
  assertMetrics(firstIterationMetrics);
  const firstIterationMetricNames = Object.keys(firstIterationMetrics);
  if (firstIterationMetricNames.length === 0) {
    throw new Error(
      `measure must return a non empty object, received an object without key`,
    );
  }

  const metricsWithIteration = {};
  firstIterationMetricNames.forEach((metricName) => {
    const metric = firstIterationMetrics[metricName];
    metricsWithIteration[metricName] = {
      values: [metric.value],
      unit: metric.unit,
    };
  });

  if (iterationCount === 1) {
    return metricsWithIteration;
  }

  const iterationArray = new Array(iterationCount - 1).fill();
  await iterationArray.reduce(async (previous, _, index) => {
    await previous;

    const currentMetrics = await measure();
    assertMetrics(currentMetrics);
    const currentIterationMetricNames = Object.keys(currentMetrics);
    const missingMetricNamesInCurrentIteration =
      firstIterationMetricNames.filter(
        (firstIterationMetricName) =>
          !currentIterationMetricNames.includes(firstIterationMetricName),
      );
    const extraMetricNamesInCurrentIteration =
      currentIterationMetricNames.filter(
        (currentIterationMetricName) =>
          !firstIterationMetricNames.includes(currentIterationMetricName),
      );
    if (
      missingMetricNamesInCurrentIteration.length ||
      extraMetricNamesInCurrentIteration.length
    ) {
      throw new Error(
        createVariableMetricNamesErrorMessage({
          missingMetricNamesInCurrentIteration,
          extraMetricNamesInCurrentIteration,
          iterationIndex: index,
        }),
      );
    }

    firstIterationMetricNames.forEach((metricName) => {
      const metricWithIteration = metricsWithIteration[metricName];
      const currentMetric = currentMetrics[metricName];
      if (currentMetric.unit !== metricWithIteration.unit) {
        throw new Error(
          createDetailedMessage(
            `A metric unit has changed between iterations.`,
            {
              "metric unit on first iteration": metricWithIteration.unit,
              [`metric unit on iteration ${index + 1}`]: currentMetric.unit,
              "metric name": metricName,
            },
          ),
        );
      }
      metricWithIteration.values.push(currentMetric.value);
    });

    // await a little bit to let previous execution the time to potentially clean up things
    await new Promise((resolve) => {
      setTimeout(resolve, msToWaitBetweenEachIteration);
    });
  }, Promise.resolve());

  return metricsWithIteration;
};

const createVariableMetricNamesErrorMessage = ({
  missingMetricNamesInCurrentIteration,
  extraMetricNamesInCurrentIteration,
  iterationIndex,
}) => {
  return createDetailedMessage(
    `Measure must return the same metric names when runned multiple times, on call number ${
      iterationIndex + 2
    }, metric names are different.`,
    {
      ...(missingMetricNamesInCurrentIteration.length
        ? {
            "missing metric names": missingMetricNamesInCurrentIteration,
          }
        : {}),
      ...(extraMetricNamesInCurrentIteration.length
        ? {
            "extra metric names": extraMetricNamesInCurrentIteration,
          }
        : {}),
    },
  );
};
