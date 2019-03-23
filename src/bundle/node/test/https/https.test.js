import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder } from "../../../../../projectFolder.js"
import { bundleNode } from "../../bundleNode.js"

bundleNode({
  projectFolder,
  entryPointsDescription: {
    main: "src/bundle/node/test/https/https.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
})
