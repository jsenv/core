import { readFileSync } from "fs"
import { basename } from "path"
import { assert } from "@dmail/assert"
import { fileUrlToPath, resolveFileUrl } from "../../../src/urlHelpers.js"
import {
  jsenvCoreDirectoryUrl,
  transformJs,
  transformResultToCompilationResult,
} from "../../../index.js"
import { importMetaUrlToDirectoryRelativePath } from "../../importMetaUrlToDirectoryRelativePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectDirectoryPath = fileUrlToPath(jsenvCoreDirectoryUrl)
const directoryRelativePath = importMetaUrlToDirectoryRelativePath(import.meta.url)
const directoryBasename = basename(directoryRelativePath)
const sourceRelativePath = `${directoryRelativePath}${directoryBasename}.js`
const fileUrl = resolveFileUrl(sourceRelativePath, jsenvCoreDirectoryUrl)
const filePath = fileUrlToPath(fileUrl)
const fileContent = readFileSync(filePath).toString()

const transformResult = await transformJs({
  code: fileContent,
  url: fileUrl,
  projectDirectoryPath,
  babelPluginMap: jsenvBabelPluginMap,
})
const actual = transformResultToCompilationResult(transformResult, {
  source: fileContent,
  sourceUrl: fileUrl,
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
})
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [sourceRelativePath],
  sourcesContent: [fileContent],
  assets: [`${directoryBasename}.js.map`],
  assetsContent: [actual.assetsContent[0]],
}
assert({ actual, expected })
