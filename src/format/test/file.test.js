import { localRoot } from "../../localRoot.js"
import { format } from "../format.js"

format({
  localRoot,
  formatPatternMapping: {
    "src/format/test/file.js": true,
  },
})
