import { assert } from "@dmail/assert"
import { parseDependencies } from "../../parseDependencies.js"
import { localRoot } from "../../../localRoot.js"

const ressource = "src/parse-dependencies/test/three-sibling/three-sibling.js"

;(async () => {
  const root = localRoot

  const actual = await parseDependencies({
    root,
    ressource,
  })

  const expected = {
    "src/parse-dependencies/test/three-sibling/leaf.js": [],
    "src/parse-dependencies/test/three-sibling/sibling.js": [
      {
        abstract: "src/parse-dependencies/test/three-sibling/leaf.js",
        real: "src/parse-dependencies/test/three-sibling/leaf.js",
      },
    ],
    "src/parse-dependencies/test/three-sibling/three-sibling.js": [
      {
        abstract: "src/parse-dependencies/test/three-sibling/sibling.js",
        real: "src/parse-dependencies/test/three-sibling/sibling.js",
      },
    ],
  }

  assert({ actual, expected })
})()
