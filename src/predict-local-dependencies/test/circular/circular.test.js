import { resolveModuleSpecifier } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { predictLocalDependencies } from "../../predictLocalDependencies.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = `src/predict-local-dependencies/test/circular`
const ressource = `${testRoot}/circular.js`

;(async () => {
  const root = localRoot
  const file = `${root}/${ressource}`

  const actual = await predictLocalDependencies({
    file,
    resolve: ({ specifier, specifierFile }) =>
      resolveModuleSpecifier({ root, moduleSpecifier: specifier, file: specifierFile }),
  })

  const dependencyFile = `${root}/${testRoot}/dependency.js`
  const expected = {
    [file]: [
      {
        specifier: "./dependency.js",
        specifierFile: file,
        file: dependencyFile,
      },
    ],
    [dependencyFile]: [
      {
        specifier: "./circular.js",
        specifierFile: dependencyFile,
        file,
      },
    ],
  }

  assert({ actual, expected })
})()
