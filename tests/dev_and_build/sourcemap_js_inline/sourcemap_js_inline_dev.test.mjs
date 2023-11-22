import { takeDirectorySnapshotAndCompare } from "@jsenv/snapshot";
import { ensureEmptyDirectory } from "@jsenv/filesystem";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  await ensureEmptyDirectory(new URL("./.jsenv/", import.meta.url));
  const devServer = await startDevServer({
    logLevel: "warn",
    clientAutoreload: false,
    ribbon: false,
    // ensure supervisor is tested here because it cooks inline content
    // which might lead to sourcemap referencing source using the same sourcemap
    supervisor: true,
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    sourcemaps: "file",
    port: 0,
    ...params,
  });
  await executeInBrowser({
    url: `${devServer.origin}/main.html`,
  });
  const runtimeId = Array.from(devServer.kitchenCache.keys())[0];
  takeDirectorySnapshotAndCompare(
    new URL(`./.jsenv/${runtimeId}/`, import.meta.url),
    new URL(`./snapshots/dev/`, import.meta.url),
    false,
  );
};

await test();
