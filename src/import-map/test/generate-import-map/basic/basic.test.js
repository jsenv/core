import { assert } from "/node_modules/@dmail/assert/index.js"
import { generateImportMapForProjectNodeModules } from "../../../generateImportMapForProjectNodeModules.js"

const { projectFolder } = import.meta.require("../../../../../jsenv.config.js")
const testFolder = `${projectFolder}/src/import-map/test/generate-import-map/basic`

;(async () => {
  const actual = await generateImportMapForProjectNodeModules({
    projectFolder: testFolder,
  })
  const expected = {
    imports: {
      "@dmail/yo/": "/node_modules/@dmail/yo/",
      "@dmail/yo": "/node_modules/@dmail/yo/index.js",
      "bar/": "/node_modules/bar/",
      "foo/": "/node_modules/foo/",
      bar: "/node_modules/bar/bar.js",
      foo: "/node_modules/foo/foo.js",
    },
    scopes: {
      "/node_modules/foo/node_modules/bar/": {
        "/node_modules/foo/node_modules/bar/": "/node_modules/foo/node_modules/bar/",
        "/": "/node_modules/foo/node_modules/bar/",
      },
      "/node_modules/@dmail/yo/": {
        "/node_modules/@dmail/yo/": "/node_modules/@dmail/yo/",
        "/": "/node_modules/@dmail/yo/",
      },
      "/node_modules/bar/": {
        "/node_modules/bar/": "/node_modules/bar/",
        "/": "/node_modules/bar/",
      },
      "/node_modules/foo/": {
        "/node_modules/bar/": "/node_modules/foo/node_modules/bar/",
        "/node_modules/foo/": "/node_modules/foo/",
        "bar/": "/node_modules/foo/node_modules/bar/",
        bar: "/node_modules/foo/node_modules/bar/index.js",
        "/": "/node_modules/foo/",
      },
    },
  }
  assert({
    actual,
    expected,
  })
})()
