import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";
import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem";
import { createLogger } from "@jsenv/humanize";
import { assertMetrics } from "./internal/assertions.js";
import { computeMetricsMedian } from "./internal/compute_metrics_median.js";
import { formatMetricsLog } from "./internal/format_metrics_log.js";
import { measureMultipleTimes } from "./internal/measure_multiple_times.js";

export const importMetricFromFiles = async ({
  logLevel,
  directoryUrl,
  metricsDescriptions,
}) => {
  const logger = createLogger({ logLevel });

  directoryUrl = assertAndNormalizeDirectoryUrl(directoryUrl);

  const allMetrics = {};
  await Object.keys(metricsDescriptions).reduce(
    async (previous, metricName) => {
      await previous;

      const metricsDescription = metricsDescriptions[metricName];
      const {
        file,
        env,
        params,
        iterations,
        msToWaitBetweenEachIteration = 100,
      } = metricsDescription;
      const url = new URL(file, directoryUrl).href;

      const measure = async () => {
        const metrics = await importOneExportFromFile(url, { env, params });
        assertMetrics(metrics, `in ${file}`);
        return metrics;
      };

      const metricsWithIterations = await measureMultipleTimes(
        measure,
        iterations,
        {
          msToWaitBetweenEachIteration,
        },
      );
      const metrics = computeMetricsMedian(metricsWithIterations);

      logger.info(formatMetricsLog(metrics));

      allMetrics[metricName] = metrics;
    },
    Promise.resolve(),
  );

  return allMetrics;
};
