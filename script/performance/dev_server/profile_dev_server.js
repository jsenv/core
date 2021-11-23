/*
 * 1. Run the following commands
 *    rm -rf ./script/performance/dev_server/.jsenv/
 *    node --inspect ./script/performance/dev_server/profile_dev_server.js
 * 2. Open "chrome://inspect" in chrome
 * 3. Inspect this file in chrome devtools
 * 4. Click "Start" in chrome devtools
 * 5. Open "https://localhost:6789/script/performance/dev_server/.jsenv/dev/best/script/performance/dev_server/basic_app/main.html" in a browser
 *    It will trigger the http requests, populating the server performances
 * Can also open "https://localhost:6789/script/performance/dev_server/basic_app/main.html"
 * to test source files
 */

import {
  urlToRelativeUrl,
  resolveUrl,
  ensureEmptyDirectory,
} from "@jsenv/filesystem"
import { requestCertificateForLocalhost } from "@jsenv/https-local"
import { startDevServer } from "@jsenv/core"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost()

const projectDirectoryUrl = new URL("../../../", import.meta.url)
const directoryRelativeUrl = urlToRelativeUrl(
  new URL("./", import.meta.url),
  projectDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${directoryRelativeUrl}.jsenv/`
const jsenvDirectoryUrl = resolveUrl(
  jsenvDirectoryRelativeUrl,
  projectDirectoryUrl,
)
await ensureEmptyDirectory(jsenvDirectoryUrl)

await startDevServer({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  compileServerLogLevel: "info",
  compileServerProtocol: "https",
  // compileServerHttp2: false,
  compileServerCertificate: serverCertificate,
  compileServerPrivateKey: serverCertificatePrivateKey,
  compileServerPort: 6789,
  livereloading: true,
  jsenvToolbar: false,
})
