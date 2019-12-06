import { readFileSync } from "fs"
import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToFilePath } from "internal/urlUtils.js"
import { transformJs } from "internal/compiling/js-compilation-service/transformJs.js"
import { TRANSFORM_JS_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryname = basename(testDirectoryUrl)
const filename = `${testDirectoryname}.js`
const originalFileUrl = import.meta.resolve(`./${filename}`)
const filePath = urlToFilePath(originalFileUrl)
const originalFileContent = readFileSync(filePath).toString()

const { code } = await transformJs({
  ...TRANSFORM_JS_TEST_PARAMS,
  code: originalFileContent,
  url: originalFileUrl,
})
const actual = code.indexOf("async function")
const expected = -1
assert({ actual, expected })
