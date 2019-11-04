import { basename } from "path"
import { startServer } from "@dmail/server"
import { assert } from "@dmail/assert"
import { resolveDirectoryUrl } from "../../../src/urlHelpers.js"
import { generateCommonJsBundle, bundleToCompilationResult } from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"
import { requireCommonJsBundle } from "../require-commonjs-bundle.js"
import {
  COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
} from "../commonjs-bundling-test-param.js"

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const bundleDirectoryRelativePath = `${testDirectoryRelativePath}dist/commonjs`
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
  ...COMMONJS_BUNDLING_TEST_GENERATE_PARAM,
  bundleDirectoryRelativePath,
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
  ...COMMONJS_BUNDLING_TEST_REQUIRE_PARAM,
  bundleDirectoryRelativePath,
})
const expected = 42
assert({ actual, expected })

server.stop()
