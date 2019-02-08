import { assert } from "@dmail/assert"
import { predictLocalDependencies } from "../../predictLocalDependencies.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = "src/predict-local-dependencies/test/keyword-static-template"
const ressource = `${testRoot}/keyword-static-template.js`

;(async () => {
  const root = localRoot

  const actual = await predictLocalDependencies({
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
