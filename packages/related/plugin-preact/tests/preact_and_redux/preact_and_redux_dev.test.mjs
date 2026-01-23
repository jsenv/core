import { startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotDevTests } from "@jsenv/core/tests/snapshot_dev_tests.js";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { chromium } from "playwright";

const run = async ({ browserLauncher }) => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    outDirectoryUrl: import.meta.resolve("./.jsenv/"),
    keepProcessAlive: false,
    port: 0,
    plugins: [
      jsenvPluginPreact(),
      jsenvPluginCommonJs({
        include: {
          "/**/node_modules/react-is/": true,
          "/**/node_modules/use-sync-external-store/": {
            external: ["react"],
          },
          "/**/node_modules/hoist-non-react-statics/": {
            // "react-redux" depends on
            // - react-is@18+
            // - hoist-non-react-statics@3.3.2+
            // but "hoist-non-react-statics@3.3.2" depends on
            // - react-is@16+
            // In the end there is 2 versions of react-is trying to cohabit
            // to prevent them to clash we let rollup inline "react-is" into "react-statics"
            // thanks to the comment below
            // external: ["react-is"],
          },
        },
      }),
    ],
    sourcemaps: "none",
  });
  return executeHtml(`${devServer.origin}/main.html`, {
    browserLauncher,
  });
};

await snapshotDevTests(
  import.meta.url,
  ({ test }) => {
    test("0_chromium", () => run({ browserLauncher: chromium }));
  },
  {
    filesystemEffects: false,
  },
);
