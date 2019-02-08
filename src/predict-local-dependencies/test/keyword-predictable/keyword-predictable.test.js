import { assert } from "@dmail/assert"
import { predictLocalDependencies } from "../../predictLocalDependencies.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = "src/predict-local-dependencies/test/keyword-predictable"
const ressource = `${testRoot}/keyword-predictable.js`

;(async () => {
  const root = localRoot

  const actual = await predictLocalDependencies({
    root,
    ressource,
  })
  const expected = {
    [ressource]: [
      {
        abstract: `${testRoot}/top-level.js`,
        real: `${testRoot}/top-level.js`,
      },
    ],
    [`${testRoot}/top-level.js`]: [],
  }
  assert({ actual, expected })
})()
