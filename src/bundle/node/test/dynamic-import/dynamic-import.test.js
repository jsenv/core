import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { bundleNode } from "../../bundleNode.js"

const projectFolder = `${selfProjectFolder}/src/bundle/node/test/dynamic-import`

bundleNode({
  projectFolder,
  into: "dist/node",
  entryPointsDescription: {
    main: "dynamic-import.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  verbose: true,
})
