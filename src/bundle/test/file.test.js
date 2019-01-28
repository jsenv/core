import { bundle } from "../bundle.js"
import { localRoot } from "../../localRoot.js"

bundle({
  file: "src/bundle/test/fixtures/file.js",
  root: localRoot,
  into: "dist",
})
