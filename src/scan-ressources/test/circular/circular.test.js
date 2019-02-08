import { resolveModuleSpecifier, resolveAPossibleNodeModuleFile } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { scanReferencedRessourcesInFile } from "../../scanReferencedRessourcesInFile.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = `src/scan-ressources/test/circular`
const ressource = `${testRoot}/circular.js`

;(async () => {
  const root = localRoot
  const file = `${root}/${ressource}`

  const actual = await scanReferencedRessourcesInFile({
    file,
    resolve: ({ specifier, specifierFile }) =>
      resolveModuleSpecifier({ root, moduleSpecifier: specifier, file: specifierFile }),
    resolveReal: (file) => resolveAPossibleNodeModuleFile(file) || file,
  })

  const dependencyFile = `${root}/${testRoot}/dependency.js`
  const expected = {
    [file]: {
      referencedByFile: undefined,
      referencedBySpecifier: undefined,
      unpredictable: [],
      remotePredictable: [],
      localPredictable: [
        {
          specifier: "./dependency.js",
          specifierFile: file,
          file: dependencyFile,
          realFile: dependencyFile,
        },
      ],
    },
    [dependencyFile]: {
      referencedByFile: file,
      referencedBySpecifier: "./dependency.js",
      unpredictable: [],
      remotePredictable: [],
      localPredictable: [
        {
          specifier: "./circular.js",
          specifierFile: dependencyFile,
          file,
          realFile: file,
        },
      ],
    },
  }

  assert({ actual, expected })
})()
