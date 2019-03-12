import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { bundleNode } from "../../bundleNode.js"

const projectFolder = `${selfProjectFolder}/src/bundle/node/test/top-level-await`

bundleNode({
  projectFolder,
  into: "dist/node",
  entryPointsDescription: {
    main: "top-level-await.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  verbose: true,
})
