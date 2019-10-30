import { readFileSync } from "fs"
import { basename } from "path"
import { assert } from "@dmail/assert"
import { createInstrumentBabelPlugin } from "@jsenv/testing/src/coverage/instrument-babel-plugin.js"
import { fileUrlToPath, resolveFileUrl } from "../../../src/urlHelpers.js"
import {
  jsenvCoreDirectoryUrl,
  transformJs,
  transformResultToCompilationResult,
} from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectDirectoryUrl = jsenvCoreDirectoryUrl
const testDirectoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const fileBasename = `${testDirectoryBasename}.js`
const fileRelativePath = `${testDirectoryRelativePath}${fileBasename}`
const fileUrl = resolveFileUrl(fileRelativePath, jsenvCoreDirectoryUrl)
const filePath = fileUrlToPath(fileUrl)
const fileContent = readFileSync(filePath).toString()

const transformResult = await transformJs({
  code: fileContent,
  url: fileUrl,
  projectDirectoryUrl,
  babelPluginMap: {
    ...jsenvBabelPluginMap,
    "transform-instrument": [createInstrumentBabelPlugin()],
  },
})
const actual = transformResultToCompilationResult(transformResult, {
  source: fileContent,
  sourceUrl: fileUrl,
  projectDirectoryUrl,
})
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [fileRelativePath],
  sourcesContent: [fileContent],
  assets: [`${fileBasename}.map`, "coverage.json"],
  assetsContent: [actual.assetsContent[0], actual.assetsContent[1]],
}
assert({ actual, expected })
