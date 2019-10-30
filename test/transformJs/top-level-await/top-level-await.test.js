import { readFileSync } from "fs"
import { basename } from "path"
import { assert } from "@dmail/assert"
import { fileUrlToPath, resolveFileUrl } from "../../../src/urlHelpers.js"
import { jsenvCoreDirectoryUrl, transformJs } from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const fileBasename = `${testDirectoryBasename}.js`
const fileRelativePath = `${testDirectoryRelativePath}${fileBasename}`
const fileUrl = resolveFileUrl(fileRelativePath, jsenvCoreDirectoryUrl)
const filePath = fileUrlToPath(fileUrl)
const fileContent = readFileSync(filePath).toString()

const { code } = await transformJs({
  code: fileContent,
  url: fileUrl,
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  babelPluginMap: jsenvBabelPluginMap,
})
const actual = code.indexOf("async function")
const expected = -1
assert({ actual, expected })
