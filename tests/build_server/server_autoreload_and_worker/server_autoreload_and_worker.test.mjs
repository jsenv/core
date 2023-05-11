/*
 * At some point startBuildServer was resolving while server was not yet listening
 * It is because there is no way to know when the worker job is done
 * except using worker.postMessage to notify the parent
 * This test ensure server can be requested right after "startBuildServer" resolves
 * to ensure there is no regression on that
 */

import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";

import { startBuildServer } from "@jsenv/core";

if (process.platform !== "win32") {
  const buildServer = await startBuildServer({
    logLevel: "warn",
    // serverLogLevel: "debug",
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    buildMainFilePath: "./main.html",
    keepProcessAlive: false,
  });
  const response = await fetchUrl(buildServer.origin);
  const actual = {
    status: response.status,
    contentType: response.headers.get("content-type"),
  };
  const expected = {
    status: 200,
    contentType: "text/html",
  };
  assert({ actual, expected });
}
