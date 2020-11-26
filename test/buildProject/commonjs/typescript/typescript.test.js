import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { requireCommonJsBuild } from "../requireCommonJsBuild.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const transformTypeScript = require("@babel/plugin-transform-typescript")

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
const mainFilename = `${testDirectoryname}.ts`

await buildProject({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  babelPluginMap: {
    ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS.babelPluginMap,
    "transform-typescript": [transformTypeScript],
  },
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.cjs",
  },
})
const { namespace: actual } = await requireCommonJsBuild({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  buildDirectoryRelativeUrl,
})
const expected = { value: "Hello, Jane User" }
assert({ actual, expected })
