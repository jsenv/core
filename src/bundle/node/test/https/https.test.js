import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder } from "../../../../../projectFolder.js"
import { bundleNode } from "../../bundleNode.js"

bundleNode({
  projectFolder,
  entryPointMap: {
    main: "src/bundle/node/test/https/https.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
})
