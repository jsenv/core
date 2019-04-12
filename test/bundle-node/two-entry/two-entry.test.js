import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

await bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointMap: {
    a: "a.js",
    b: "b.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  verbose: true,
})

{
  const { namespace: actual } = await importNodeBundle({
    bundleFolder: `${testFolder}/dist/node`,
    file: `a.js`,
  })
  const expected = "a-shared"
  assert({ actual, expected })
}
{
  const { namespace: actual } = await importNodeBundle({
    bundleFolder: `${testFolder}/dist/node`,
    file: `b.js`,
  })
  const expected = "b-shared"
  assert({ actual, expected })
}
