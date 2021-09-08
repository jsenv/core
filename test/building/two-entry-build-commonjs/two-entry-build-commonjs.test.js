import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"
import { requireCommonJsBuild } from "@jsenv/core/test/requireCommonJsBuild.js"
import { buildProject } from "@jsenv/core"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs/`
const firstEntryRelativeUrl = `${testDirectoryRelativeUrl}a.js`
const secondEntryRelativeUrl = `${testDirectoryRelativeUrl}b.js`

const { buildManifest, buildMappings } = await buildProject({
  ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${firstEntryRelativeUrl}`]: "./a.cjs",
    [`./${secondEntryRelativeUrl}`]: "./b.cjs",
  },
  assetManifestFile: true,
  assetManifestFileRelativeUrl: "manifest.json",
})

{
  const actual = buildMappings
  const expected = {
    [`${testDirectoryRelativeUrl}a.js`]: "a.cjs",
    [`${testDirectoryRelativeUrl}b.js`]: "b.cjs",
    [`${testDirectoryRelativeUrl}used-by-both.js`]:
      actual[`${testDirectoryRelativeUrl}used-by-both.js`],
  }
  assert({ actual, expected })
}

{
  const manifestFileRelativeUrl = `${buildDirectoryRelativeUrl}manifest.json`
  const manifestFileUrl = resolveUrl(manifestFileRelativeUrl, jsenvCoreDirectoryUrl)
  const manifestFileContent = await readFile(manifestFileUrl)
  const manifestFileObject = JSON.parse(manifestFileContent)
  const actual = manifestFileObject
  const expected = {
    [`a.cjs`]: "a.cjs",
    [`b.cjs`]: "b.cjs",
    [`used-by-both.cjs`]: actual[`used-by-both.cjs`],
  }
  assert({ actual, expected })

  {
    const actual = manifestFileObject
    const expected = buildManifest
    assert({ actual, expected })
  }
}
{
  const { namespace: actual } = await requireCommonJsBuild({
    ...REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
    buildDirectoryRelativeUrl,
    mainRelativeUrl: "./a.cjs",
  })
  const expected = { value: "a-shared" }
  assert({ actual, expected })
}
{
  const { namespace: actual } = await requireCommonJsBuild({
    ...REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
    buildDirectoryRelativeUrl,
    mainRelativeUrl: "./b.cjs",
  })
  const expected = { value: "b-shared" }
  assert({ actual, expected })
}
