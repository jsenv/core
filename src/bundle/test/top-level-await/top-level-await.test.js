import blockScoping from "@babel/plugin-transform-block-scoping"
import { bundle } from "../../bundle.js"
import { localRoot } from "../../../localRoot.js"

bundle({
  root: localRoot,
  into: "bundle",
  entryPointObject: {
    main: "src/bundle/test/top-level-await/top-level-await.js",
  },
  pluginMap: {
    "transform-block-scoping": [blockScoping],
  },
})
