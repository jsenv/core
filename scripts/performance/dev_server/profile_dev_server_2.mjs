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

import { startServer, fetchFileSystem } from "@jsenv/server"
import { requestCertificateForLocalhost } from "@jsenv/https-local"
import { urlToRelativeUrl, resolveUrl } from "@jsenv/urls"
import { ensureEmptyDirectory } from "@jsenv/filesystem"

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

await startServer({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  logLevel: "info",
  protocol: "https",
  http2: true,
  // http2: false,
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  port: 6789,
  sendServerTiming: true,
  requestToResponse: (request) => {
    return fetchFileSystem(
      new URL(request.ressource.slice(1), projectDirectoryUrl),
      {
        headers: request.headers,
      },
    )
  },
})
