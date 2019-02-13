import blockScoping from "@babel/plugin-transform-block-scoping"
import { root } from "../../../../root.js"
import { bundleNode } from "../../bundleNode.js"

bundleNode({
  entryPointObject: {
    main: "src/bundle/node/test/debugger/debugger.js",
  },
  root,
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
})
