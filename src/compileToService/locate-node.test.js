import { assert } from "@dmail/assert"
import { locate } from "./locate.js"
import { root } from "../root.js"

// referer being a sibling node module
{
  const actual = locate({
    requestPathname: "build/best/node_modules/bar/bar.js",
    refererFile: "build/best/node_modules/foo/foo.js",
    compileInto: "build",
    root: `${root}/src/compileToService/test/fixtures`,
  })
  const expected = {
    compileId: "best",
    projectFile: "node_modules/bar/bar.js",
    file: `${root}/src/compileToService/test/fixtures/node_modules/bar/bar.js`,
  }
  assert({ actual, expected })
}

// without referer
{
  const actual = locate({
    requestPathname: "build/best/node_modules/bar/bar.js",
    compileInto: "build",
    root: `${root}/src/compileToService/test/fixtures`,
  })
  const expected = {
    compileId: "best",
    projectFile: "node_modules/bar/bar.js",
    file: `${root}/src/compileToService/test/fixtures/node_modules/bar/bar.js`,
  }
  assert({ actual, expected })
}
