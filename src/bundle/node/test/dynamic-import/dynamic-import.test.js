import blockScoping from "@babel/plugin-transform-block-scoping"
import { root } from "../../../../root.js"
import { bundleNode } from "../../bundleNode.js"

bundleNode({
  entryPointObject: {
    main: "src/bundle/node/test/dynamic-import/dynamic-import.js",
  },
  root,
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
})
