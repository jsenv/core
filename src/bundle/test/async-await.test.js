import { bundle } from "../bundle.js"
import { localRoot } from "../../localRoot.js"
import blockScoping from "@babel/plugin-transform-block-scoping"

bundle({
  ressource: "src/bundle/test/fixtures/async-await.js",
  root: localRoot,
  into: "bundle",
  transformAsyncToPromise: true,
  babelPlugins: [blockScoping],
})
