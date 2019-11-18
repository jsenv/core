import { basename } from "path"
import { startServer } from "@jsenv/server"
import { assert } from "@jsenv/assert"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { resolveDirectoryUrl, urlToRelativePath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { generateCommonJsBundle } from "../../../index.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativePath(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativePath}dist/commonjs`
const mainFileBasename = `${testDirectoryBasename}.js`

const server = await startServer({
  protocol: "http",
  ip: "127.0.0.1",
  port: 9999,
  requestToResponse: () => {
    const body = `export default 42`

    return {
      status: 200,
      headers: {
        "content-type": "application/javascript",
        "content-length": Buffer.byteLength(body),
      },
      body,
    }
  },
  logLevel: "off",
})

const bundle = await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `${testDirectoryRelativePath}${mainFileBasename}`,
  },
})

{
  const actual = bundleToCompilationResult(bundle, {
    projectDirectoryUrl: resolveDirectoryUrl("./", import.meta.url),
  })
  const expected = {
    contentType: "application/javascript",
    compiledSource: actual.compiledSource,
    sources: ["http.js"],
    sourcesContent: [actual.sourcesContent[0]],
    assets: ["main.js.map"],
    assetsContent: [actual.assetsContent[0]],
  }
  assert({ actual, expected })

  {
    const actual = JSON.parse(actual.assetsContent[0])
    const expected = {
      version: actual.version,
      file: "main.js",
      sources: ["http://127.0.0.1:9999/file.js"],
      sourcesContent: ["export default 42"],
      names: actual.names,
      mappings: actual.mappings,
    }
    assert({ actual, expected })
  }
}

const { namespace: actual } = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
const expected = 42
assert({ actual, expected })

server.stop()
