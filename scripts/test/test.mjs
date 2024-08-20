/*
 * Execute all test files
 * - npm test
 * Read more in https://github.com/jsenv/core/tree/main/packages/test#jsenvtest-
 */

import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

if (process.argv.length === 2) {
  process.argv.push("./tests/");
}
await executeTestPlan({
  logs: {
    level: "info",
    platformInfo: true,
    memoryUsage: true,
    cpuUsage: true,
  },
  rootDirectoryUrl: new URL("../../", import.meta.url),
  testPlan: {
    "./tests/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
        allocatedMs: ({ fileRelativeUrl }) => {
          if (fileRelativeUrl.endsWith("_snapshots.test.mjs")) {
            return 180_000;
          }
          if (
            fileRelativeUrl.endsWith("import_assert_type_css_build.test.mjs") ||
            fileRelativeUrl.endsWith("autoreload_js_import_css.test.mjs")
          ) {
            return 90_000;
          }
          if (
            fileRelativeUrl.endsWith("preload_js_module_build.test.mjs") ||
            fileRelativeUrl.endsWith("import_assert_type_css_dev.test.mjs") ||
            fileRelativeUrl.endsWith("preload_local_font_build.test.mjs")
          ) {
            return 60_000;
          }
          return 30_000;
        },
      },
    },
    "./packages/**/*.test.mjs": {
      node: {
        runtime: nodeWorkerThread(),
        allocatedMs: ({ fileRelativeUrl }) => {
          if (fileRelativeUrl.endsWith("test_plan_logs_browsers.test.mjs")) {
            return 160_000;
          }
          if (
            fileRelativeUrl.endsWith("_browsers.test.mjs") ||
            fileRelativeUrl.endsWith("test_plan_logs_node.test.mjs")
          ) {
            return 90_000;
          }
          if (
            fileRelativeUrl.endsWith("coverage_browsers_and_node.test.mjs") ||
            fileRelativeUrl.endsWith("browser_tabs.test.mjs") ||
            fileRelativeUrl.endsWith("fragment.test.mjs")
          ) {
            return 60_000;
          }
          if (
            fileRelativeUrl.endsWith(
              "service-worker/tests/errors/errors_snapshots.test.mjs",
            ) ||
            fileRelativeUrl.endsWith(
              "service-worker/tests/update/update_snapshots.test.mjs",
            ) ||
            fileRelativeUrl.endsWith("react_build.test.mjs") ||
            fileRelativeUrl.endsWith("react_refresh.test.mjs") ||
            fileRelativeUrl.endsWith("toolbar_basic.test.mjs")
          ) {
            return 90_000;
          }
          return undefined;
        },
        uses: ({ fileRelativeUrl }) => {
          if (
            fileRelativeUrl.endsWith(
              "service-worker/tests/errors/errors_snapshots.test.mjs",
            ) ||
            fileRelativeUrl.endsWith(
              "service-worker/tests/update/update_snapshots.test.mjs",
            )
          ) {
            return ["service-worker"];
          }
          return undefined;
        },
      },
    },
    "./packages/**/*.test.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
    "./packages/**/with_signal_warnings.test.mjs": {
      node: {
        runtime: nodeWorkerThread({
          commandLineOptions: ["--no-warnings"],
        }),
      },
    },
    "./packages/**/https-local/": {
      node: null, // disabled for now
    },
    "./packages/**/cli/": {
      // the templates have their own test script that will be trigerred by
      // npm run workspace:test
      node: null,
    },
  },
  githubCheck: process.env.CI
    ? {
        name: `@jsenv/core tests (${process.platform})`,
      }
    : null,
});
