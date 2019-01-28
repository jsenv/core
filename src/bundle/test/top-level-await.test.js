import { bundle } from "../bundle.js"
import { localRoot } from "../../localRoot.js"

bundle({
  ressource: "src/bundle/test/fixtures/top-level-await.js",
  root: localRoot,
  into: "bundle",
})
