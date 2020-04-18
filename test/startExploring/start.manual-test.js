import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../index.js"
import { START_EXPLORING_TEST_PARAMS } from "./TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}template.html`

startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  logLevel: "info",
  // compileServerLogLevel: "info",
  trackingLogLevel: "debug",
  jsenvDirectoryRelativeUrl,
  htmlFileRelativeUrl,
  explorableConfig: {
    [`./${testDirectoryRelativeUrl}**/*.main.js`]: true,
    [`./${testDirectoryRelativeUrl}**/.jsenv/**`]: false,
  },
  protocol: "http",
  port: 3400,
  keepProcessAlive: true,
})
