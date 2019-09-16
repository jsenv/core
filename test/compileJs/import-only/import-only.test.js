import { readFileSync } from "fs"
import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { jsenvCorePathname, compileJs } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = `${jsenvCorePathname}${fileHrefToFolderRelativePath(import.meta.url)}`
const sourceRelativePath = `/import-only.js`
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
  assets: [`import-only.js__asset__/import-only.js.map`],
  assetsContent: [actual.assetsContent[0]],
}

assert({
  actual,
  expected,
})
