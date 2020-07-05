/**

I think the sometimes poor perf of compile server comes from this:

node.js is overhelmed by things to do
in that context it takes the opportunity to delay promise resolution
and a promise might take 50/100ms to resolve (or more)

consequently a dumb request ends up taking 600ms when it would take 50ms

- node ./test-manual/exploring-2/start-exploring-2.js

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
  compileServerProtocol: "https",
  compileServerPort: 3456,
  keepProcessAlive: true,
  // jsenvDirectoryClean: true,
  stopOnPackageVersionChange: false,
  // useFilesystemAsCache: false,
  // writeOnFileSystem: false,
})
