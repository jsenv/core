import { bundle } from "../../bundle.js"
import { localRoot } from "../../../localRoot.js"

bundle({
  ressource: "src/bundle/test/fixtures/code-splitting.js",
  root: localRoot,
  into: "bundle",
})
