import blockScoping from "@babel/plugin-transform-block-scoping"
import { localRoot } from "../../../../localRoot.js"
import { bundleNode } from "../../bundleNode.js"

bundleNode({
  root: localRoot,
  entryPointObject: {
    a: "src/bundle/node/test/two-entry/a.js",
    b: "src/bundle/node/test/two-entry/b.js",
  },
  pluginMap: {
    "transform-block-scoping": [blockScoping],
  },
})
