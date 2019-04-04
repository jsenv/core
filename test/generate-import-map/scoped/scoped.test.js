import { assert } from "/node_modules/@dmail/assert/index.js"
import { remapResolvedImport } from "/node_modules/@jsenv/module-resolution/index.js"
import { generateImportMapForProjectNodeModules } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/generate-import-map/scoped`

;(async () => {
  const importMap = await generateImportMapForProjectNodeModules({
    projectFolder: testFolder,
  })

  const resolve = ({ importer, specifier }) =>
    remapResolvedImport({
      importMap,
      importerHref: `http://example.com/${importer}`,
      resolvedImport: `http://example.com/${specifier}`,
    }).slice("http://example.com/".length)

  // import 'bar' inside project
  {
    const actual = resolve({ importer: "scoped.js", specifier: "bar" })
    const expected = "node_modules/bar/bar.js"
    assert({ actual, expected })
  }

  // import 'bar' inside foo
  {
    const actual = resolve({ importer: "node_modules/foo/foo.js", specifier: "bar" })
    const expected = "node_modules/foo/node_modules/bar/bar.js"
    assert({ actual, expected })
  }
})()
