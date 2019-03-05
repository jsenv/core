import { assert } from "@dmail/assert"
import { compileToService } from "../../compileToService.js"
import { projectFolder as selfProjectFolder } from "../../../projectFolder.js"

const projectFolder = `${selfProjectFolder}/src/compileToService/test/redirect-node-module`
const compileInto = "build"
const compileId = "group"
const origin = `http://${compileId}.127.0.0.1`
const compileDescription = { [compileId]: {} }

;(async () => {
  {
    const compileService = compileToService(() => {}, {
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
      status: 307,
      headers: {
        vary: "referer",
        location: `${origin}/node_modules/foo/node_modules/bar/src/bar.js`,
      },
    }
    assert({ actual, expected })
  }
})()
