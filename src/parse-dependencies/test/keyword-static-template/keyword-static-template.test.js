import { assert } from "@dmail/assert"
import { parseDependencies } from "../../parseDependencies.js"
import { localRoot } from "../../../localRoot.js"

const ressource = "src/parse-dependencies/test/keyword-static-template/keyword-static-template.js"

;(async () => {
  const root = localRoot

  const actual = await parseDependencies({
    root,
    ressource,
  })
  const expected = {
    "src/parse-dependencies/test/keyword-static-template/file.js": [],
    "src/parse-dependencies/test/keyword-static-template/keyword-static-template.js": [
      {
        abstract: "src/parse-dependencies/test/keyword-static-template/file.js",
        real: "src/parse-dependencies/test/keyword-static-template/file.js",
      },
    ],
  }
  assert({ actual, expected })
})()
