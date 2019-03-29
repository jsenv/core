import { assert } from "/node_modules/@dmail/assert/index.js"
import { compileToService } from "../../compileToService.js"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"

const projectFolder = `${selfProjectFolder}/src/compileToService/test/node-module`
const compileInto = ".dist"
const compileId = "group"
const origin = `http://127.0.0.1`
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
      ressource: `/${compileInto}/${compileId}/node_modules/bar/src/bar.js`,
      headers: {
        referer: `${origin}/${compileInto}/${compileId}/node_modules/foo/src/foo.js`,
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
