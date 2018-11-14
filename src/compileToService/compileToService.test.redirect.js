import { compileToService } from "./compileToService.js"
import assert from "assert"

const test = async () => {
  // locate 307 on module more nested than expected
  {
    const compileService = compileToService(() => {}, {
      localRoot: "root",
      compileInto: "build",
      locate: () => "node_modules/dependency/node_modules/package/index.js",
    })

    const actual = await compileService({
      origin: "http://127.0.0.1",
      ressource: "build/foo/package/index.js",
      headers: {
        referer: "http://127.0.0.1/build/foo/node_modules/dependency/index.js",
      },
    })
    const expected = {
      status: 307,
      headers: {
        location:
          "http://127.0.0.1/build/foo/node_modules/dependency/node_modules/package/index.js",
      },
    }
    assert.deepEqual(actual, expected)
  }

  // locate 307 on module less nested than expected
  {
    const compileService = compileToService(() => {}, {
      localRoot: "root",
      compileInto: "build",
      locate: () => "node_modules/package/index.js",
    })

    const actual = await compileService({
      origin: "http://127.0.0.1",
      ressource: "build/foo/node_modules/dependency/node_modules/package/index.js",
      headers: {
        referer: "http://127.0.0.1/build/foo/node_modules/dependency/index.js",
      },
    })
    const expected = {
      status: 307,
      headers: {
        location: "http://127.0.0.1/build/foo/node_modules/package/index.js",
      },
    }
    assert.deepEqual(actual, expected)
  }

  console.log("passed")
}

test()
