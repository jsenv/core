import { basename } from "path"
import { startServer } from "@jsenv/server"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { bundleToCompilationResult } from "../../../src/internal/bundling/bundleToCompilationResult.js"
import { generateCommonJsBundle } from "../../../index.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`
const server = await startServer({
  logLevel: "warn",
  protocol: "https",
  ip: "127.0.0.1",
  port: 9999,
  keepProcessAlive: false,
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
})

const bundle = await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `./${testDirectoryRelativeUrl}${mainFilename}`,
  },
})
const compilationResult = bundleToCompilationResult(bundle, {
  projectDirectoryUrl: testDirectoryUrl,
  compiledFileUrl: resolveUrl(`${bundleDirectoryRelativeUrl}main.cjs`, jsenvCoreDirectoryUrl),
  sourcemapFileUrl: resolveUrl(`${bundleDirectoryRelativeUrl}main.cjs.map`, jsenvCoreDirectoryUrl),
})
{
  const actual = compilationResult
  const expected = {
    contentType: "application/javascript",
    compiledSource: actual.compiledSource,
    sources: [],
    sourcesContent: [],
    assets: ["../main.cjs.map"],
    assetsContent: [actual.assetsContent[0]],
  }
  assert({ actual, expected })
}
{
  const actual = JSON.parse(actual.assetsContent[0])
  const expected = {
    version: actual.version,
    file: "main.cjs",
    sources: [`${server.origin}/file.js`],
    sourcesContent: null,
    names: actual.names,
    mappings: actual.mappings,
  }
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBundle({
    ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
  })
  const expected = 42
  assert({ actual, expected })
}
