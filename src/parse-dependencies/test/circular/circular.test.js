import { assert } from "@dmail/assert"
import { parseDependencies } from "../../parseDependencies.js"
import { localRoot } from "../../../localRoot.js"

const ressource = "src/parse-dependencies/test/circular/circular.js"

;(async () => {
  const root = localRoot

  const actual = await parseDependencies({
    root,
    ressource,
  })
  const expected = {
    "src/parse-dependencies/test/circular/circular.js": [
      {
        abstract: "src/parse-dependencies/test/circular/dependency.js",
        real: "src/parse-dependencies/test/circular/dependency.js",
      },
    ],
    "src/parse-dependencies/test/circular/dependency.js": [
      {
        abstract: "src/parse-dependencies/test/circular/circular.js",
        real: "src/parse-dependencies/test/circular/circular.js",
      },
    ],
  }

  assert({ actual, expected })
})()
