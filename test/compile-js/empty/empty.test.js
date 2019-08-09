import { readFileSync } from "fs"
import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { JSENV_PATHNAME } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { compileJs } from "../../../src/compiled-js-service/compileJs.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = JSENV_PATHNAME
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const sourceRelativePath = `${folderJsenvRelativePath}/empty.js`
const filename = pathnameToOperatingSystemPath(`${projectPathname}${sourceRelativePath}`)
const source = readFileSync(filename).toString()

const actual = await compileJs({
  projectPathname,
  sourceRelativePath,
  babelPluginMap: jsenvBabelPluginMap,
})
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [sourceRelativePath],
  sourcesContent: [source],
  assets: ["empty.js__asset__/empty.js.map"],
  assetsContent: [actual.assetsContent[0]],
}
assert({
  actual,
  expected,
})
