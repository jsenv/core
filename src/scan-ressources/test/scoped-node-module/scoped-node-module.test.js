import { assert } from "@dmail/assert"
import { scanReferencedRessourcesInFile } from "../../scanReferencedRessourcesInFile.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = "src/predict-local-dependencies/test/scoped-node-module"
const ressource = `${testRoot}/scoped-node-module.js`

;(async () => {
  const root = localRoot

  const actual = await scanReferencedRessourcesInFile({
    root,
    ressource,
  })
  const expected = {
    [ressource]: [
      {
        abstract: `${testRoot}/node_modules/use-scoped-foo/use-scoped-foo.js`,
        real: `${testRoot}/node_modules/use-scoped-foo/use-scoped-foo.js`,
      },
    ],
    [`${testRoot}/node_modules/use-scoped-foo/use-scoped-foo.js`]: [
      {
        abstract: `${testRoot}/node_modules/use-scoped-foo/node_modules/foo/foo.js`,
        real: `${testRoot}/node_modules/use-scoped-foo/node_modules/foo/foo.js`,
      },
    ],
    [`${testRoot}/node_modules/use-scoped-foo/node_modules/foo/foo.js`]: [],
  }
  assert({ actual, expected })
})()
