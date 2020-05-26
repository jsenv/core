import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../index.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

startExploring({
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  explorableConfig: {
    source: {
      [`./${testDirectoryRelativeUrl}**/pages/**/*.js`]: true,
      [`./${testDirectoryRelativeUrl}**/.jsenv/**`]: false,
    },
  },
  protocol: "http",
  port: 3400,
  compileServerPort: 3456,
  keepProcessAlive: true,
})
