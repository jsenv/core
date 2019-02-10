import blockScoping from "@babel/plugin-transform-block-scoping"
import { localRoot } from "../../../localRoot.js"
import { bundleNode } from "../../node/bundleNode.js"

bundleNode({
  root: localRoot,
  entryPointObject: {
    main: "src/bundle/test/basic/basic.js",
  },
  pluginMap: {
    "transform-block-scoping": [blockScoping],
  },
})
