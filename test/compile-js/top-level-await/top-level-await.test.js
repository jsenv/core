import { assert } from "@dmail/assert"
import { JSENV_PATHNAME } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { compileJs } from "../../../src/compileJs.js"

const { jsenvBabelPluginMap: babelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = JSENV_PATHNAME
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const sourceRelativePath = `${folderJsenvRelativePath}/top-level-await.js`

const { compiledSource } = await compileJs({
  projectPathname,
  sourceRelativePath,
  babelPluginMap,
})
const actual = compiledSource.indexOf("async function")
const expected = -1
assert({ actual, expected })
