/*
 * This file is designed to be executed locally or by an automated process.
 *
 * To run it locally
 * - npm run performances
 *
 * It can be used to monitor performances using an automated process
 * like a GitHub workflow as documented in
 * https://github.com/jsenv/workflow/tree/main/packages/jsenv-performance-impact
 */

import { importMetricFromFiles } from "@jsenv/performance-impact"

const { packageImportMetrics, packageTarballMetrics } =
  await importMetricFromFiles({
    directoryUrl: new URL("./", import.meta.url),
    metricsDescriptions: {
      packageImportMetrics: {
        file: "./measures/package_import.mjs#packageImportMetrics",
        iterations: process.argv.includes("--once") ? 1 : 7,
        msToWaitBetweenEachIteration: 500,
      },
      packageTarballMetrics: {
        file: "./measures/package_tarball.mjs#packageTarballmetrics",
        iterations: 1,
      },
    },
    logLevel: process.argv.includes("--log") ? "info" : "warn",
  })

export const performanceReport = {
  "package metrics": {
    ...packageImportMetrics,
    ...packageTarballMetrics,
  },
}
