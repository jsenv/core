import { assert } from "@dmail/assert"
import { parseDependencies } from "../../parseDependencies.js"
import { localRoot } from "../../../localRoot.js"

const testRoot = "src/parse-dependencies/test/scoped-node-module"
const ressource = `${testRoot}/scoped-node-module.js`

;(async () => {
  const root = localRoot

  const actual = await parseDependencies({
    root,
    ressource,
  })
  const expected = {
    [`${testRoot}/scoped-node-module.js`]: [
      {
        abstract: `${testRoot}/node_modules/use-scoped-foo/use-scoped-foo.js`,
        real: `${testRoot}/node_modules/use-scoped-foo/use-scoped-foo.js`,
      },
    ],
    [`${testRoot}/node_modules/use-scoped-foo/use-scoped-foo.js`]: [
      {
        abstract: `${testRoot}/node_modules/use-scoped-foo/node_modules/foo/foo.js`,
        real: `${testRoot}/node_modules/use-scoped-foo/node_modules/foo/foo.js`,
      },
    ],
    [`${testRoot}/node_modules/use-scoped-foo/node_modules/foo/foo.js`]: [],
  }
  assert({ actual, expected })
})()
