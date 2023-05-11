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

const {
  tarballMetrics,
  importMetrics,
  devServerMetrics,
  buildMetrics,
  testPlanMetrics,
} = await importMetricFromFiles({
  logLevel: process.argv.includes("--log") ? "info" : "warn",
  directoryUrl: new URL("./", import.meta.url),
  metricsDescriptions: {
    tarballMetrics: {
      file: "./measure_npm_tarball/measure_npm_tarball.mjs#tarballMetrics",
      iterations: 1,
    },
    importMetrics: {
      file: "./measure_import/measure_import.mjs#importMetrics",
      iterations: process.argv.includes("--once") ? 1 : 7,
      msToWaitBetweenEachIteration: 500,
    },
    devServerMetrics: {
      file: "./dev_server/measure_dev_server.mjs#devServerMetrics",
      iterations: process.argv.includes("--once") ? 1 : 3,
      msToWaitBetweenEachIteration: 500,
    },
    buildMetrics: {
      file: "./measure_build/measure_build.mjs#buildMetrics",
      iterations: process.argv.includes("--once") ? 1 : 7,
      msToWaitBetweenEachIteration: 500,
    },
    testPlanMetrics: {
      file: "./measure_test_plan/measure_test_plan.mjs#testPlanMetrics",
      iterations: process.argv.includes("--once") ? 1 : 3,
      msToWaitBetweenEachIteration: 500,
    },
  },
});

export const performanceReport = {
  "package metrics": {
    ...importMetrics,
    ...tarballMetrics,
  },
  "dev server metrics": {
    ...devServerMetrics,
  },
  "build metrics": {
    ...buildMetrics,
  },
  "test metrics": {
    ...testPlanMetrics,
  },
};
