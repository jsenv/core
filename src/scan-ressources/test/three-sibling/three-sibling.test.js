import { assert } from "@dmail/assert"
import { scanReferencedRessourcesInFile } from "../../scanReferencedRessourcesInFile.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = "src/predict-local-dependencies/test/three-sibling"
const ressource = `${testRoot}/three-sibling.js`

;(async () => {
  const root = localRoot

  const actual = await scanReferencedRessourcesInFile({
    root,
    ressource,
  })

  const expected = {
    [ressource]: [
      {
        abstract: `${testRoot}/sibling.js`,
        real: `${testRoot}/sibling.js`,
      },
    ],
    [`${testRoot}/sibling.js`]: [
      {
        abstract: `${testRoot}/leaf.js`,
        real: `${testRoot}/leaf.js`,
      },
    ],
    [`${testRoot}/leaf.js`]: [],
  }

  assert({ actual, expected })
})()
