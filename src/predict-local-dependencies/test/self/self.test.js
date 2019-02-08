import { assert } from "@dmail/assert"
import { predictLocalDependencies } from "../../predictLocalDependencies.js"
import { localRoot } from "../../../localRoot.js"

const ressource = "src/predict-local-dependencies/test/self/self.js"

;(async () => {
  const root = localRoot

  try {
    await predictLocalDependencies({
      root,
      ressource,
    })
  } catch (e) {
    assert({
      actual: e,
      expected: new Error(`unexpected self dependency.
root: ${root}
ressource: ${ressource}
specifier: ./self.js`),
    })
  }
})()
