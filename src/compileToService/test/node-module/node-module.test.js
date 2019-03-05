import { assert } from "@dmail/assert"
import { compileToService } from "../../compileToService.js"
import { projectFolder as selfProjectFolder } from "../../../projectFolder.js"

const projectFolder = `${selfProjectFolder}/src/compileToService/test/node-module`
const compileInto = "build"
const compileId = "group"
const origin = `http://${compileId}.127.0.0.1`
const compileDescription = { [compileId]: {} }
const compile = () => {
  return { output: "yo" }
}

;(async () => {
  {
    const compileService = compileToService(compile, {
      projectFolder,
      compileInto,
      compileDescription,
    })

    const actual = await compileService({
      origin,
      ressource: `/node_modules/bar/src/bar.js`,
      headers: {
        referer: `${origin}/node_modules/foo/src/foo.js`,
      },
    })
    const expected = {
      status: 200,
      headers: {
        "content-length": 2,
        "content-type": "application/javascript",
        eTag: `"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"`,
        vary: "referer",
      },
      body: "yo",
    }
    assert({ actual, expected })
  }
})()
