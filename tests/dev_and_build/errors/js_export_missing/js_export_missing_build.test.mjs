import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./main.html": {} },
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: import.meta.resolve("./build/"),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    test("0_basic", () => run());
  },
  {
    executionEffects: {
      catch: (error) => {
        if (error.message) {
          error.message = error.message.split("\n").slice(0, 3).join("\n");
        }
        if (error.cause) {
          error.cause = {
            code: error.cause.code,
          };
        }
      },
    },
  },
);
