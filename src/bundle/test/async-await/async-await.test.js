import { bundle } from "../../bundle.js"
import { localRoot } from "../../../localRoot.js"
import blockScoping from "@babel/plugin-transform-block-scoping"

bundle({
  root: localRoot,
  into: "bundle",
  pluginMap: {
    "transform-block-scoping": [blockScoping],
  },
  entryPointObject: {
    main: "src/bundle/test/async-await/async-await.js",
  },
})
