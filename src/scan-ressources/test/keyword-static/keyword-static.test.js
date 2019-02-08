import { assert } from "@dmail/assert"
import { scanReferencedRessourcesInFile } from "../../scanReferencedRessourcesInFile.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = "src/predict-local-dependencies/test/keyword-static"
const ressource = `${testRoot}/keyword-static.js`

;(async () => {
  const root = localRoot

  const actual = await scanReferencedRessourcesInFile({
    root,
    ressource,
  })
  const expected = {
    [ressource]: [
      {
        abstract: `${testRoot}/file.js`,
        real: `${testRoot}/file.js`,
      },
    ],
    [`${testRoot}/file.js`]: [],
  }
  assert({ actual, expected })
})()
