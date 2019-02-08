import { assert } from "@dmail/assert"
import { predictLocalDependencies } from "../../predictLocalDependencies.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = `src/predict-local-dependencies/test/circular`
const ressource = `${testRoot}/circular.js`

;(async () => {
  const root = localRoot

  const actual = await predictLocalDependencies({
    root,
    ressource,
  })
  const expected = {
    [ressource]: [
      {
        abstract: `${testRoot}/dependency.js`,
        real: `${testRoot}/dependency.js`,
      },
    ],
    [`${testRoot}/dependency.js`]: [
      {
        abstract: ressource,
        real: ressource,
      },
    ],
  }

  assert({ actual, expected })
})()
