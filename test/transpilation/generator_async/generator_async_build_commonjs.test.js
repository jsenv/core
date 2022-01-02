import { assert } from "@jsenv/assert"
import {
  readFile,
  resolveDirectoryUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_COMMONJS.js"
import { requireCommonJsBuild } from "@jsenv/core/test/requireCommonJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/commonjs`
await buildProject({
  ...GENERATE_COMMONJS_BUILD_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}generator_async.js`]: "main.cjs",
  },
})

// generator was transpiled
{
  const fileContent = await readFile(
    new URL("./dist/commonjs/main.cjs", import.meta.url),
  )
  const actual = fileContent.includes("function*")
  const expected = false
  assert({ actual, expected })
}

// generator works as expected
{
  const { namespace } = await requireCommonJsBuild({
    ...REQUIRE_COMMONJS_BUILD_TEST_PARAMS,
    buildDirectoryRelativeUrl,
  })
  const iterator = namespace.ask()
  const first = await iterator.next()
  const second = await iterator.next()

  const actual = {
    first,
    second,
  }
  const expected = {
    first: { value: 42, done: false },
    second: { value: undefined, done: true },
  }
  assert({ actual, expected })
}
