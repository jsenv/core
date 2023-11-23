import { ensureEmptyDirectory, copyDirectorySync } from "@jsenv/filesystem";

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
  copyDirectorySync({
    from: new URL(`./.jsenv/${runtimeId}/`, import.meta.url),
    to: new URL(`./snapshots/dev/`, import.meta.url),
    overwrite: true,
  });
};

await test();
