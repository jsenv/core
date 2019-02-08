import { assert } from "@dmail/assert"
import { predictDependencies } from "../../predictDependencies.js"
import { localRoot } from "../../../localRoot.js"

const ressource = "src/predict-dependencies/test/self/self.js"

;(async () => {
  const root = localRoot

  try {
    await predictDependencies({
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
