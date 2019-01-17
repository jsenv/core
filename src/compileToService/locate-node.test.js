import { assert } from "@dmail/assert"
import { locate } from "./locate.js"
import { localRoot } from "../localRoot.js"

// referer being a sibling node module
{
  const actual = locate({
    requestFile: "build/best/node_modules/bar/bar.js",
    refererFile: "build/best/node_modules/foo/foo.js",
    compileInto: "build",
    localRoot: `${localRoot}/src/compileToService/test/fixtures`,
  })
  const expected = {
    compileId: "best",
    projectFile: "node_modules/bar/bar.js",
    file: `${localRoot}/src/compileToService/test/fixtures/node_modules/bar/bar.js`,
  }
  assert({ actual, expected })
}

// without referer
{
  const actual = locate({
    requestFile: "build/best/node_modules/bar/bar.js",
    compileInto: "build",
    localRoot: `${localRoot}/src/compileToService/test/fixtures`,
  })
  const expected = {
    compileId: "best",
    projectFile: "node_modules/bar/bar.js",
    file: `${localRoot}/src/compileToService/test/fixtures/node_modules/bar/bar.js`,
  }
  assert({ actual, expected })
}
