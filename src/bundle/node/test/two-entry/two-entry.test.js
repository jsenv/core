import blockScoping from "@babel/plugin-transform-block-scoping"
import { root } from "../../../../root.js"
import { bundleNode } from "../../bundleNode.js"

bundleNode({
  entryPointsDescription: {
    a: "src/bundle/node/test/two-entry/a.js",
    b: "src/bundle/node/test/two-entry/b.js",
  },
  root,
  pluginMap: {
    "transform-block-scoping": [blockScoping],
  },
})
