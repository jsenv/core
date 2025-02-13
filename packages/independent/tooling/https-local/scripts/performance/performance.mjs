/*
 * This file is designed to be executed locally or by an automated process.
 *
 * To run it locally, use one of
 * - node --expose-gc ./scripts/performance/generate_performance_report.mjs --log
 * - npm run measure-performances
 *
 * The automated process is a GitHub workflow: ".github/workflows/performance_impact.yml"
 * It will dynamically import this file and get the "performanceReport" export
 *
 * See https://github.com/jsenv/performance-impact
 */

import { importMetricFromFiles } from "@jsenv/performance-impact";

const { packageImportMetrics, packageTarballMetrics } =
  await importMetricFromFiles({
    directoryUrl: new URL("./", import.meta.url),
    metricsDescriptions: {
      packageImportMetrics: {
        file: "./measure_package_import.mjs#packageImportMetrics",
        iterations: process.argv.includes("--local") ? 1 : 7,
        msToWaitBetweenEachIteration: 500,
      },
      packageTarballMetrics: {
        file: "./measure_package_tarball.mjs#packageTarballmetrics",
        iterations: 1,
      },
    },
    logLevel: process.argv.includes("--log") ? "info" : "warn",
  });

export const performanceReport = {
  "package metrics": {
    ...packageImportMetrics,
    ...packageTarballMetrics,
  },
};
