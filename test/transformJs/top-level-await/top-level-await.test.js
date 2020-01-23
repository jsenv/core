import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, readFile } from "@jsenv/util"
import { transformJs } from "../../../src/internal/compiling/js-compilation-service/transformJs.js"
import { TRANSFORM_JS_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryname = basename(testDirectoryUrl)
const filename = `${testDirectoryname}.js`
const originalFileUrl = resolveUrl(`./${filename}`, testDirectoryUrl)
const originalFileContent = await readFile(originalFileUrl)

const { code } = await transformJs({
  ...TRANSFORM_JS_TEST_PARAMS,
  code: originalFileContent,
  url: originalFileUrl,
})
const actual = code.indexOf("async function")
const expected = -1
assert({ actual, expected })
