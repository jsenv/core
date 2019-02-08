import { assert } from "@dmail/assert"
import { predictDependencies } from "../../predictDependencies.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = "src/predict-dependencies/test/keyword-static-template"
const ressource = `${testRoot}/keyword-static.js`

;(async () => {
  const root = localRoot

  const actual = await predictDependencies({
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
