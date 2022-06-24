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

import { requestCertificateForLocalhost } from "@jsenv/https-local"
import { startDevServer } from "@jsenv/core"

const { certificate, privateKey } = requestCertificateForLocalhost()

await startDevServer({
  rootDirectoryUrl: new URL("./basic_app/", import.meta.url),
  logLevel: "info",
  protocol: "https",
  // http2: false,
  certificate,
  privateKey,
  port: 6789,
  toolbar: false,
})
