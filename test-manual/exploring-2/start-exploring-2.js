/**

*/

import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { startExploring } from "../../index.js"
import { jsenvCoreDirectoryUrl } from "../../src/internal/jsenvCoreDirectoryUrl.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

startExploring({
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  explorableConfig: {
    source: {
      [`./${testDirectoryRelativeUrl}**/*.html`]: true,
    },
  },
  jsenvDirectoryRelativeUrl,
  compileServerProtocol: "http",
  compileServerPort: 3456,
  keepProcessAlive: true,
  // jsenvDirectoryClean: true,
  stopOnPackageVersionChange: false,
})

// /test-manual/exploring-2/.jsenv/out/otherwise/test-manual/exploring-2/basic/basic.html
