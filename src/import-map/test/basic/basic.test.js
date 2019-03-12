import { assert } from "@dmail/assert"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { generateImportMapForProjectNodeModules } from "../../generateImportMapForProjectNodeModules.js"

const projectFolder = `${selfProjectFolder}/src/import-map/test/basic`

;(async () => {
  const actual = await generateImportMapForProjectNodeModules({ projectFolder })
  const expected = {
    imports: {
      "@dmail/yo": "/node_modules/@dmail/yo/index.js",
      "@dmail/yo/": "/node_modules/@dmail/yo/",
      bar: "/node_modules/bar/bar.js",
      "bar/": "/node_modules/bar/",
      foo: "/node_modules/foo/foo.js",
      "foo/": "/node_modules/foo/",
    },
    scopes: {
      "/node_modules/foo/": {
        bar: "/node_modules/foo/node_modules/bar/index.js",
        "bar/": "/node_modules/foo/node_modules/bar/",
        "/node_modules/bar/": "/node_modules/foo/node_modules/bar/",
      },
    },
  }
  assert({
    actual,
    expected,
  })
})()
