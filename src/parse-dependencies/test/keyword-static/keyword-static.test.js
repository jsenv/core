import { assert } from "@dmail/assert"
import { parseDependencies } from "../../parseDependencies.js"
import { localRoot } from "../../../localRoot.js"

const ressource = "src/parse-dependencies/test/keyword-static/keyword-static.js"

;(async () => {
  const root = localRoot

  const actual = await parseDependencies({
    root,
    ressource,
  })
  const expected = {
    "src/parse-dependencies/test/keyword-static/file.js": [],
    "src/parse-dependencies/test/keyword-static/keyword-static.js": [
      {
        abstract: "src/parse-dependencies/test/keyword-static/file.js",
        real: "src/parse-dependencies/test/keyword-static/file.js",
      },
    ],
  }
  assert({ actual, expected })
})()
