import blockScoping from "@babel/plugin-transform-block-scoping"
import { root } from "../../../../root.js"
import { bundleNode } from "../../bundleNode.js"

bundleNode({
  entryPointObject: {
    main: "src/bundle/node/test/basic/basic.js",
  },
  root,
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
})
