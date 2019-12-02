import { assert } from "@jsenv/assert"
import { urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { installBrowserErrorStackRemapping } from "internal/error-stack-remapping/installBrowserErrorStackRemapping.js"
import { fetchAndEvalUsingScript } from "internal/fetchAndEvalUsingScript.js"

const fileRelativeUrl = urlToRelativeUrl(import.meta.url, jsenvCoreDirectoryUrl)

await fetchAndEvalUsingScript("/node_modules/source-map/dist/source-map.js")
const { SourceMapConsumer } = window.sourceMap
SourceMapConsumer.initialize({
  "lib/mappings.wasm": "/node_modules/source-map/lib/mappings.wasm",
})

const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
  SourceMapConsumer,
})

const error = new Error()
const stackString = error.stack
{
  const compiledFileUrl = import.meta.resolve(`./dist/best/${fileRelativeUrl}`)
  const actual = stackString.includes(compiledFileUrl)
  const expected = true
  assert({ actual, expected })
}
const originalStackString = await getErrorOriginalStackString(error)
{
  const actual = originalStackString.includes(import.meta.url)
  const expected = true
  assert({ actual, expected })
}
