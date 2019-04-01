import { assert } from "/node_modules/@dmail/assert/index.js"
import { generateImportMapForProjectNodeModules } from "../../../generateImportMapForProjectNodeModules.js"

const { projectFolder } = import.meta.require("../../../../../jsenv.config.js")
const testFolder = `${projectFolder}/src/import-map/test/generate-import-map/symlink/project`

;(async () => {
  const actual = await generateImportMapForProjectNodeModules({
    projectFolder: testFolder,
  })
  const expected = {
    imports: {
      "foo/": "/node_modules/foo/",
      foo: "/node_modules/foo/index.js",
    },
    scopes: {
      "/node_modules/foo/": {
        "/node_modules/foo/": "/node_modules/foo/",
        "/": "/node_modules/foo/",
      },
    },
  }
  assert({
    actual,
    expected,
  })
})()
