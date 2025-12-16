import { startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotDevSideEffects } from "@jsenv/core/tests/snapshot_dev_side_effects.js";
import { chromium } from "playwright";

const run = async () => {
  const sourceDirectoryUrl = new URL("./client/", import.meta.url);
  const devServer = await startDevServer({
    sourceDirectoryUrl,
    keepProcessAlive: false,
    clientAutoreload: {
      clientServerEventsConfig: {
        logs: false,
      },
    },
    port: 0,
  });
  return executeHtml(`${devServer.origin}/main.html`, {
    pageFunction: () => window.__supervisor__.getDocumentExecutionResult(),
  });
};

await snapshotDevSideEffects(
  import.meta.url,
  ({ test }) => {
    test("0_chromium", () => run({ browserLauncher: chromium }));
  },
  {
    executionEffects: { catch: true },
  },
);
