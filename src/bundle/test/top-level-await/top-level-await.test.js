import blockScoping from "@babel/plugin-transform-block-scoping"
import { bundleNode } from "../../node/bundleNode.js/index.js"
import { localRoot } from "../../../localRoot.js"

bundleNode({
  root: localRoot,
  into: "bundle",
  entryPointObject: {
    main: "src/bundle/test/top-level-await/top-level-await.js",
  },
  pluginMap: {
    "transform-block-scoping": [blockScoping],
  },
})
