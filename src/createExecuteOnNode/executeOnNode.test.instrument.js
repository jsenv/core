import path from "path"
import { openCompileServer } from "../openCompileServer/index.js"
import { executeOnNode } from "./executeOnNode.js"

const root = path.resolve(__dirname, "../../../")
const into = "build"
const watch = true
const watchPredicate = () => true
const instrument = true
const instrumentPredicate = () => true
// const file = "src/__test__/file.js"
const file = `src/createExecuteOnNode/fixtures/file.js`

executeOnNode({
  openCompileServer,
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
