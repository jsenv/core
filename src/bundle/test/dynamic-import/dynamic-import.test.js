import { bundle } from "../bundle.js"
import { localRoot } from "../../localRoot.js"

bundle({
  ressource: "src/bundle/test/fixtures/dynamic-import.js",
  root: localRoot,
  into: "bundle",
})
