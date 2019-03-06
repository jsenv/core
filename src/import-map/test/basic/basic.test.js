import { assert } from "@dmail/assert"
import { projectFolder } from "../../../projectFolder.js"
import { generateImportMapForNodeModules } from "../../generateImportMapForNodeModules.js"

const foldername = `${projectFolder}/src/import-map/test/basic`

;(async () => {
  const actual = await generateImportMapForNodeModules({ foldername })
  const expected = {
    scopes: {
      "/node_modules/foo/": {
        "/node_modules/bar/": "/node_modules/foo/node_modules/bar/",
      },
    },
  }
  assert({
    actual,
    expected,
  })
})()
