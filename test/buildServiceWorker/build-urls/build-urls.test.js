import { assert } from "@jsenv/assert"
import { resolveUrl, ensureEmptyDirectory, urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"
import { buildServiceWorker } from "@jsenv/core/src/internal/building/buildServiceWorker.js"

const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const buildDirectoryUrl = resolveUrl("./dist/", import.meta.url)
const serviceWorkerBuildUrl = resolveUrl("./sw.cjs", buildDirectoryUrl)

await ensureEmptyDirectory(buildDirectoryUrl)
await buildServiceWorker({
  projectDirectoryUrl,
  buildDirectoryUrl,
  serviceWorkerProjectRelativeUrl: "sw.js",
  serviceWorkerBuildRelativeUrl: "sw.cjs",
  serviceWorkerTransformer: (code) => `
self.jsenvBuildUrls = ["style-ef345.css"]
${code}`,
})

global.self = {}
// eslint-disable-next-line import/no-dynamic-require
require(urlToFileSystemPath(serviceWorkerBuildUrl))
const actual = global.self.jsenvBuildUrlsValue
const expected = ["style-ef345.css"]
assert({ actual, expected })
