/*
 * Execute all test files
 * - npm test
 * Read more in https://github.com/jsenv/core/tree/main/packages/test#jsenvtest-
 */

import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

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
        runtime: nodeWorkerThread({
          env: {
            NO_SNAPSHOT_ASSERTION: process.argv.includes(
              "--no-snapshot-assertion",
            )
              ? "1"
              : "",
          },
        }),
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
  },
  githubCheck: process.env.CI
    ? {
        name: `@jsenv/core tests (${process.platform})`,
      }
    : null,
});
