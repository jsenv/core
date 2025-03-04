/*
 * 1. Run the following commands
 *    rm -rf ./scripts/performance/dev_server/.jsenv/
 *    node --inspect ./scripts/performance/dev_server/profile_dev_server.js
 * 2. Open "chrome://inspect" in chrome
 * 3. Inspect this file in chrome devtools
 * 4. Click "Start" in chrome devtools
 * 5. Open "https://localhost:6789/scripts/performance/dev_server/scripts/performance/dev_server/basic_app/main.html" in a browser
 *    It will trigger the http requests, populating the server performances
 */

import { ensureEmptyDirectory } from "@jsenv/filesystem";
import { requestCertificate } from "@jsenv/https-local";
import { createFileSystemRequestHandler, startServer } from "@jsenv/server";
import { resolveUrl, urlToRelativeUrl } from "@jsenv/urls";

const { certificate, privateKey } = requestCertificate();
const projectDirectoryUrl = new URL("../../../", import.meta.url);
const directoryRelativeUrl = urlToRelativeUrl(
  new URL("./", import.meta.url),
  projectDirectoryUrl,
);
const jsenvDirectoryRelativeUrl = `${directoryRelativeUrl}.jsenv/`;
const jsenvDirectoryUrl = resolveUrl(
  jsenvDirectoryRelativeUrl,
  projectDirectoryUrl,
);
await ensureEmptyDirectory(jsenvDirectoryUrl);

await startServer({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  logLevel: "info",
  http2: true,
  https: { certificate, privateKey },
  port: 6789,
  serverTiming: true,
  routes: [
    {
      endpoint: "GET *",
      response: createFileSystemRequestHandler(projectDirectoryUrl),
    },
  ],
});
