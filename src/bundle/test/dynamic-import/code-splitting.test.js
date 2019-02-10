import { bundleNode } from "../../node/bundleNode.js/index.js"
import { localRoot } from "../../../localRoot.js"

bundleNode({
  root: localRoot,
  into: "bundle",
  ressource: "src/bundle/test/fixtures/code-splitting.js",
})
