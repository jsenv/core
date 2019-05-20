import { readFileSync } from "fs"
import { assert } from "@dmail/assert"
import { JSENV_PATHNAME } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { compileJs } from "../../../src/compiled-js-service/compileJs.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = JSENV_PATHNAME
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const sourceRelativePath = `${folderJsenvRelativePath}/empty.js`
const filename = `${projectPathname}${sourceRelativePath}`
const source = readFileSync(filename).toString()

const actual = await compileJs({
  source,
  projectPathname,
  sourceRelativePath,
  babelPluginMap: jsenvBabelPluginMap,
})
assert({
  actual,
  expected: {
    compiledSource: actual.compiledSource,
    contentType: "application/javascript",
    sources: [],
    sourcesContent: [],
    assets: ["empty.js__asset__/empty.js.map"],
    assetsContent: [actual.assetsContent[0]],
  },
})
