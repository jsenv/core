import path from "path"
import { executeOnNode } from "./executeOnNode.js"

const root = path.resolve(__dirname, "../../../")
const into = "build"
const watch = false
const watchPredicate = () => {}
const instrument = true
const instrumentPredicate = () => true
const file = `src/createCompile/file.js` // `src/__test__/file.js`

executeOnNode({
  root,
  into,
  file,
  instrument,
  instrumentPredicate,
  watch,
  watchPredicate,
  cacheDisabled: true,
  verbose: true,
})
