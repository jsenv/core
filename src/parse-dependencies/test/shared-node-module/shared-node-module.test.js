import { assert } from "@dmail/assert"
import { parseDependencies } from "../../parseDependencies.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = "src/parse-dependencies/test/shared-node-module"
const ressource = `${testRoot}/shared-node-module.js`

;(async () => {
  const root = localRoot

  const actual = await parseDependencies({
    root,
    ressource,
  })
  const expected = {
    [`${testRoot}/shared-node-module.js`]: [
      {
        abstract: `${testRoot}/node_modules/use-shared-foo/use-shared-foo.js`,
        real: `${testRoot}/node_modules/use-shared-foo/use-shared-foo.js`,
      },
    ],
    [`${testRoot}/node_modules/use-shared-foo/use-shared-foo.js`]: [
      {
        abstract: `${testRoot}/node_modules/use-shared-foo/node_modules/foo/foo.js`,
        real: `${testRoot}/node_modules/foo/foo.js`,
      },
    ],
    [`${testRoot}/node_modules/foo/foo.js`]: [],
  }
  assert({ actual, expected })
})()
