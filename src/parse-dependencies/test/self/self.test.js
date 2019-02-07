import { assert } from "@dmail/assert"
import { parseDependencies } from "../../parseDependencies.js"
import { localRoot } from "../../../localRoot.js"

const ressource = "src/parse-dependencies/test/self/self.js"

;(async () => {
  const root = localRoot

  try {
    await parseDependencies({
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
