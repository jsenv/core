import { ensureEmptyDirectory } from "@jsenv/filesystem";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

import { startDevServer } from "@jsenv/core";

const test = async (params) => {
  await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
  const devServer = await startDevServer({
    logLevel: "warn",
    clientAutoreload: false,
    ribbon: false,
    supervisor: false,
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    sourcemaps: "file",
    ...params,
  });
  await executeInBrowser({
    url: `${devServer.origin}/main.html`,
  });
  const runtimeId = Array.from(devServer.kitchenCache.keys())[0];
  takeDirectorySnapshot(
    new URL(`./.jsenv/${runtimeId}/`, import.meta.url),
    new URL(`./snapshots/dev/`, import.meta.url),
    false,
  );
};

await test();
